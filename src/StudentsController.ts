import { IDatabaseCollection, IDatabaseCollectionProvider } from "@js-soft/docdb-access-abstractions";
import { ApplicationError, Result } from "@js-soft/ts-utils";
import { LocalAttributeJSON } from "@nmshd/consumption";
import {
    CreateAttributeRequestItemJSON,
    DisplayNameJSON,
    RejectResponseItemJSON,
    RelationshipAttributeConfidentiality,
    RelationshipTemplateContentJSON,
    RequestJSON,
    ResponseItemResult,
    ShareAttributeRequestItemJSON,
    TransferFileOwnershipAcceptResponseItemJSON,
    TransferFileOwnershipRequestItemJSON
} from "@nmshd/content";
import { CoreDate, CoreId } from "@nmshd/core-types";
import { LocalRequestDTO, MessageDTO, RelationshipStatus, RuntimeServices } from "@nmshd/runtime";
import { DateTime } from "luxon";
import * as mustache from "mustache";
import fs from "node:fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import qrCodeLib from "qrcode";
import { SchoolFileDTO, Student, StudentAuditLog, StudentAuditLogEntry, StudentDTO, StudentStatus } from "./types";

export class StudentsController {
    #studentsCollection: IDatabaseCollection;

    public constructor(
        private readonly displayName: LocalAttributeJSON,
        private readonly playStoreLink: string | undefined,
        private readonly appStoreLink: string | undefined,
        private readonly services: RuntimeServices,
        private readonly database: IDatabaseCollectionProvider,
        private readonly assetsLocation: string,
        private readonly autoMailBeforeOffboarding: boolean,
        private readonly useNewQRCodeFormat: boolean
    ) {}

    public async init(): Promise<this> {
        this.#studentsCollection = await this.database.getCollection("students");

        return this;
    }

    public async createStudent(data: {
        id: string;
        givenname: string;
        surname: string;
        pin?: string;
        additionalConsents: { mustBeAccepted?: boolean; consent: string; link: string; linkDisplayText?: string }[];
    }): Promise<Student> {
        const identityInfo = await this.services.transportServices.account.getIdentityInfo();

        const request: RequestJSON = {
            "@type": "Request",
            items: [
                {
                    "@type": "RequestItemGroup",
                    title: "Bereitgestellte Kontaktdaten",
                    description: "Hier finden Sie alle Daten, die der neue Kontakt mit Ihnen teilen möchte.",
                    items: [
                        {
                            "@type": "ShareAttributeRequestItem",
                            attribute: this.displayName.content,
                            sourceAttributeId: this.displayName.id,
                            mustBeAccepted: true
                        } satisfies ShareAttributeRequestItemJSON,
                        {
                            "@type": "CreateAttributeRequestItem",
                            attribute: {
                                "@type": "RelationshipAttribute",
                                confidentiality: RelationshipAttributeConfidentiality.Private,
                                key: "__App_Contact_sendMailDisabled",
                                value: {
                                    "@type": "Consent",
                                    consent: "Dieser Kontakt kann keine Nachrichten von dir erhalten."
                                },
                                owner: identityInfo.value.address
                            },
                            mustBeAccepted: true
                        } satisfies CreateAttributeRequestItemJSON
                    ]
                },
                {
                    "@type": "RequestItemGroup",
                    title: "Geteilte Daten",
                    items: [
                        {
                            "@type": "ProposeAttributeRequestItem",
                            attribute: { "@type": "IdentityAttribute", owner: "", value: { "@type": "GivenName", value: data.givenname } },
                            query: { "@type": "IdentityAttributeQuery", valueType: "GivenName" },
                            mustBeAccepted: true
                        },
                        {
                            "@type": "ProposeAttributeRequestItem",
                            attribute: { "@type": "IdentityAttribute", owner: "", value: { "@type": "Surname", value: data.surname } },
                            query: { "@type": "IdentityAttributeQuery", valueType: "Surname" },
                            mustBeAccepted: true
                        }
                    ]
                }
            ]
        };

        if (data.additionalConsents.length > 0) {
            request.items.push({
                "@type": "RequestItemGroup",
                title: "Einverständniserklärungen",
                items: data.additionalConsents.map((consent) => ({
                    "@type": "ConsentRequestItem",
                    mustBeAccepted: consent.mustBeAccepted ?? false,
                    consent: consent.consent,
                    link: consent.link,
                    linkDisplayText: consent.linkDisplayText
                }))
            });
        }

        const template = await this.services.transportServices.relationshipTemplates.createOwnRelationshipTemplate({
            maxNumberOfAllocations: 1,
            content: { "@type": "RelationshipTemplateContent", onNewRelationship: request } satisfies RelationshipTemplateContentJSON,
            expiresAt: CoreDate.utc().add({ years: 1 }).toISOString(),
            passwordProtection: data.pin ? { password: data.pin, passwordIsPin: true, passwordLocationIndicator: "Email" } : undefined
        });

        const student = Student.from({ id: data.id, givenname: data.givenname, surname: data.surname, correspondingRelationshipTemplateId: template.value.id });

        await this.#studentsCollection.create(student.toJSON());

        return student;
    }

    public async getStudentAuditLog(student: Student, verbose = false): Promise<StudentAuditLog> {
        const entries: StudentAuditLogEntry[] = [];

        if (!student.correspondingRelationshipTemplateId) return entries;

        const templateRequest = await this.services.transportServices.relationshipTemplates.getRelationshipTemplate({ id: student.correspondingRelationshipTemplateId.toString() });
        const template = templateRequest.value;

        entries.push({
            time: template.createdAt,
            id: student.id.toString(),
            log: `RelationshipTemplate ${template.id} created for student`,
            object: verbose ? template : undefined
        });

        if (!student.correspondingRelationshipId) return entries;

        const getRelationshipResult = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId.toString() });
        const relationship = getRelationshipResult.value;

        for (const auditLogEntry of relationship.auditLog) {
            if (auditLogEntry.oldStatus) {
                entries.push({
                    time: auditLogEntry.createdAt,
                    id: student.id.toString(),
                    log: `RelationshipStatus of relationship ${relationship.id} changed from ${auditLogEntry.oldStatus} to ${auditLogEntry.newStatus} because of ${auditLogEntry.reason}`,
                    object: verbose ? relationship : undefined
                });
            } else {
                entries.push({
                    time: auditLogEntry.createdAt,
                    id: student.id.toString(),
                    log: `Relationship ${relationship.id} to student with enmeshed address '${relationship.peerIdentity.address}' created.`,
                    object: verbose ? relationship : undefined
                });
            }
        }

        const mails = await this.getMails(student);
        for (const mail of mails) {
            if (mail.isOwn) {
                entries.push({
                    time: mail.createdAt,
                    id: student.id.toString(),
                    log: `Mail ${mail.id} with subject '${(mail.content as any).subject}' has been sent.`,
                    object: verbose ? mail : undefined
                });
                if (mail.wasReadAt) {
                    entries.push({
                        time: mail.wasReadAt,
                        id: student.id.toString(),
                        log: `Student successfully received sent mail ${mail.id} with subject '${(mail.content as any).subject}'.`,
                        object: verbose ? mail : undefined
                    });
                }
            } else {
                entries.push({
                    time: mail.createdAt,
                    id: student.id.toString(),
                    log: `Mail with subject '${(mail.content as any).subject}' has been received from peer.`,
                    object: verbose ? mail : undefined
                });
            }
        }

        const getRequestsResult = await this.services.consumptionServices.outgoingRequests.getRequests({ query: { peer: relationship.peer } });
        const requests = getRequestsResult.value;

        for (const request of requests) {
            entries.push({
                time: request.createdAt,
                id: student.id.toString(),
                log: `Request ${request.id} has been sent to peer with source ${request.source?.reference}.`,
                object: verbose ? request : undefined
            });

            if (request.response) {
                entries.push({
                    time: request.response.createdAt,
                    id: student.id.toString(),
                    log: `Response to request ${request.id} has been received by peer with source ${request.response.source?.reference}. Status is ${request.status}.`,
                    object: verbose ? request.response : undefined
                });
            }
        }

        const files = await this.getStudentFiles(student);
        for (const file of files) {
            entries.push({
                time: file.fileSentAt,
                id: student.id.toString(),
                log: `Request with file ${file.filename} has been sent to peer.`,
                object: verbose ? file : undefined
            });

            if (file.respondedAt) {
                entries.push({
                    time: file.respondedAt,
                    id: student.id.toString(),
                    log: `Peer has received request for file ${file.filename} and responded with status ${file.status}.`,
                    object: verbose ? file : undefined
                });
            }
        }

        entries.sort((a, b) => {
            const dateA = DateTime.fromISO(a.time);
            const dateB = DateTime.fromISO(b.time);

            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            return 0;
        });

        return entries;
    }

    public async getOnboardingDataForStudent(student: Student): Promise<Result<{ pdf: Buffer; png: Buffer; link: string }>> {
        if (!student.correspondingRelationshipTemplateId || !student.givenname || !student.surname) {
            throw new ApplicationError("error.schoolModule.studentAlreadyDeleted", "The student seems to be already deleted.");
        }

        const template = await this.services.transportServices.relationshipTemplates.getRelationshipTemplate({ id: student.correspondingRelationshipTemplateId.toString() });
        if (template.isError) return Result.fail(template.error);

        const link = this.useNewQRCodeFormat ? template.value.reference.url : `nmshd://tr#${template.value.reference.truncated}`;
        const pngAsBuffer = await qrCodeLib.toBuffer(link, { type: "png" });

        const onboardingPdf = await this.createOnboardingPDF(
            {
                organizationDisplayName: (this.displayName.content.value as DisplayNameJSON).value,
                givenname: student.givenname,
                surname: student.surname,
                playStoreLink: this.playStoreLink,
                appStoreLink: this.appStoreLink
            },
            pngAsBuffer
        );

        return Result.ok({ link: link, png: pngAsBuffer, pdf: onboardingPdf });
    }

    private async createOnboardingPDF(
        data: {
            organizationDisplayName: string;
            givenname: string;
            surname: string;
            playStoreLink?: string;
            appStoreLink?: string;
        },
        pngAsBuffer: Buffer
    ) {
        const templateName = "template_onboarding.pdf";
        const pathToPdf = path.resolve(path.join(this.assetsLocation, templateName));

        if (!fs.existsSync(pathToPdf)) {
            throw new ApplicationError(
                "error.schoolModule.onboardingTemplateNotFound",
                `The onboarding template could not be found. Make sure to add the template with the name ${templateName} to the assets folder.`
            );
        }

        const formPdfBytes = await fs.promises.readFile(pathToPdf);
        const pdfDoc = await PDFDocument.load(formPdfBytes);

        const qrImage = await pdfDoc.embedPng(pngAsBuffer);
        const form = pdfDoc.getForm();

        form.getTextField("Vorname_Nachname").setText(`${data.givenname} ${data.surname}`);
        form.getTextField("Schulname_01").setText(data.organizationDisplayName);
        form.getTextField("Schulname_02").setText(data.organizationDisplayName);
        form.getTextField("Ort_Datum").setText("");
        form.getTextField("QR_Code_Schueler").setImage(qrImage);

        if (data.playStoreLink) {
            const linkAsBuffer = await qrCodeLib.toBuffer(data.playStoreLink, { type: "png" });
            const qrCode = await pdfDoc.embedPng(linkAsBuffer);
            form.getTextField("Google").setImage(qrCode);
        }

        if (data.appStoreLink) {
            const linkAsBuffer = await qrCodeLib.toBuffer(data.appStoreLink, { type: "png" });
            const qrCode = await pdfDoc.embedPng(linkAsBuffer);
            form.getTextField("Apple").setImage(qrCode);
        }

        try {
            form.flatten();
        } catch (error) {
            if (error instanceof Error && error.message.includes("WinAnsi cannot encode")) {
                throw new ApplicationError(
                    "error.schoolModule.onboardingPDFNotUTF8Compatible",
                    `Cannot write a UTF-8 string to a PDF that is not UTF-8 compatible. Please check the template '${templateName}' for UTF-8 support.`
                );
            }

            throw error;
        }

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    }

    public async getStudents(): Promise<Student[]> {
        const docs = await this.#studentsCollection.find({});

        const students = docs.map((doc: any) => Student.from(doc));
        return students;
    }

    public async getStudent(id: string): Promise<Student | undefined> {
        const doc = await this.#studentsCollection.read(id);
        return doc ? Student.from(doc) : undefined;
    }

    public async getStudentByTemplateId(templateId: string): Promise<Student> {
        const doc = await this.#studentsCollection.findOne({ correspondingRelationshipTemplateId: templateId });
        return Student.from(doc);
    }

    public async getStudentByRelationshipId(relationshipId: string): Promise<Student | undefined> {
        const doc = await this.#studentsCollection.findOne({ correspondingRelationshipId: relationshipId });

        return doc ? Student.from(doc) : undefined;
    }

    public async updateStudent(student: Student): Promise<void> {
        const oldDoc = await this.#studentsCollection.read(student.id.toString());

        await this.#studentsCollection.update(oldDoc, student.toJSON());
    }

    public async pseudonymizeStudent(student: Student): Promise<Student> {
        const oldDoc = await this.#studentsCollection.read(student.id.toString());
        const pseudonymizedDoc = {
            id: oldDoc.id
        };

        await this.#studentsCollection.update(oldDoc, pseudonymizedDoc);

        return Student.from(pseudonymizedDoc);
    }

    public async deleteStudent(student: Student): Promise<void> {
        if (student.correspondingRelationshipId) {
            const relationship = await this.getRelationship(student.correspondingRelationshipId);

            if (this.autoMailBeforeOffboarding && relationship.status === RelationshipStatus.Active) {
                await this.sendMailBasedOnTemplateName(student, "offboarding");
            }

            switch (relationship.status) {
                case RelationshipStatus.Pending:
                    await this.services.transportServices.relationships.rejectRelationship({ relationshipId: student.correspondingRelationshipId.toString() });
                    await this.services.transportServices.relationships.decomposeRelationship({ relationshipId: student.correspondingRelationshipId.toString() });
                case RelationshipStatus.Active:
                    await this.services.transportServices.relationships.terminateRelationship({ relationshipId: student.correspondingRelationshipId.toString() });
                    await this.services.transportServices.relationships.decomposeRelationship({ relationshipId: student.correspondingRelationshipId.toString() });
                case RelationshipStatus.Rejected:
                case RelationshipStatus.Revoked:
                case RelationshipStatus.Terminated:
                case RelationshipStatus.DeletionProposed:
                    await this.services.transportServices.relationships.decomposeRelationship({ relationshipId: student.correspondingRelationshipId.toString() });
            }
        }

        if (student.correspondingRelationshipTemplateId) {
            await this.services.transportServices.relationshipTemplates.deleteRelationshipTemplate({ templateId: student.correspondingRelationshipTemplateId.toString() });
        }

        await this.#studentsCollection.delete({ id: student.id.toString() });
    }

    private async getRelationship(relationshipId: CoreId) {
        const getRelationshipResult = await this.services.transportServices.relationships.getRelationship({ id: relationshipId.toString() });
        const relationship = getRelationshipResult.value;
        return relationship;
    }

    public async existsStudent(id: string): Promise<boolean> {
        return await this.#studentsCollection.exists({ id: id });
    }

    public async getMails(student: Student): Promise<MessageDTO[]> {
        if (!student.correspondingRelationshipId) throw new ApplicationError("error.schoolModule.noRelationship", "The student has no relationship.");
        const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId.toString() });
        if (relationship.isError) throw relationship.error;

        const result = await this.services.transportServices.messages.getMessages({ query: { participant: relationship.value.peer, "content.@type": "Mail" } });
        return result.value;
    }

    public async sendMailBasedOnTemplateName(student: Student, templateName: string, additionalData: any = {}): Promise<MessageDTO> {
        const templatePath = path.resolve(path.join(this.assetsLocation, `mail_${templateName}.txt`));
        if (!fs.existsSync(templatePath)) {
            throw new ApplicationError(
                "error.schoolModule.templateNotFound",
                "The template could not be found. Make sure to add the template with the name mail_<templateName>.txt to the assets folder."
            );
        }

        const mailTemplate = await fs.promises.readFile(templatePath, "utf8");

        const splitTemplate = mailTemplate.split(/\n\r|\r|\n/);
        if (splitTemplate.length < 2) {
            throw new ApplicationError("error.schoolModule.templateInvalid", "The template is invalid. Make sure to add a subject and a body.");
        }

        const subject = splitTemplate.shift()!;
        const body = splitTemplate.join("\n");

        return await this.sendMail(student, subject, body, additionalData);
    }

    public async sendMail(student: Student, rawSubject: string, rawBody: string, additionalData: any = {}): Promise<MessageDTO> {
        if (!student.correspondingRelationshipId) throw new ApplicationError("error.schoolModule.noRelationship", "The student has no relationship.");

        const subject = await this.fillMailTemplateWithStudentData(student, rawSubject, additionalData);
        const body = await this.fillMailTemplateWithStudentData(student, rawBody, additionalData);

        const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId.toString() });

        const result = await this.services.transportServices.messages.sendMessage({
            recipients: [relationship.value.peer],
            content: { "@type": "Mail", to: [relationship.value.peer], subject, body }
        });

        return result.value;
    }

    private async fillMailTemplateWithStudentData(student: Student, template: string, additionalData: any = {}): Promise<string> {
        if (!student.correspondingRelationshipTemplateId) {
            throw new ApplicationError("error.schoolModule.studentAlreadyDeleted", "The student seems to be already deleted.");
        }

        if (!student.correspondingRelationshipId) {
            throw new ApplicationError("error.schoolModule.noRelationship", "The student has no relationship.");
        }

        const relationship = await this.getRelationship(student.correspondingRelationshipId);
        if (relationship.status !== RelationshipStatus.Active) {
            throw new ApplicationError("error.schoolModule.noActiveRelationship", "The relationship to the student is not active, so sending a mail is not possible.");
        }

        const contact = await this.services.dataViewExpander.expandAddress(relationship.peer);

        const data = {
            student: {
                givenname: contact.relationship?.nameMap["GivenName"] ?? student.givenname,
                surname: contact.relationship?.nameMap["Surname"] ?? student.surname
            },
            requestBody: additionalData
        };

        const text = mustache.render(template, data);
        return text;
    }

    public async sendFile(student: Student, data: { file: string; title: string; filename: string; mimetype: string; tags?: string[] | undefined }): Promise<SchoolFileDTO> {
        if (!student.correspondingRelationshipId) throw new ApplicationError("error.schoolModule.noRelationship", "The student has no relationship.");
        const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId.toString() });

        const file = await this.services.transportServices.files.uploadOwnFile({
            content: Buffer.from(data.file, "base64"),
            tags: data.tags,
            filename: data.filename,
            mimetype: data.mimetype,
            title: data.title
        });

        const request = await this.services.consumptionServices.outgoingRequests.create({
            content: {
                items: [
                    {
                        "@type": "TransferFileOwnershipRequestItem",
                        mustBeAccepted: true,
                        requireManualDecision: true,
                        fileReference: file.value.reference.truncated
                    }
                ]
            },
            peer: relationship.value.peer
        });

        await this.services.transportServices.messages.sendMessage({ content: request.value.content, recipients: [relationship.value.peer] });

        const fileDTO = await this.requestToFileDVO(request.value);
        return fileDTO;
    }

    public async toStudentDTO(student: Student): Promise<StudentDTO> {
        let status: StudentStatus = "onboarding";

        if (student.correspondingRelationshipId) {
            const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId.toString() });
            switch (relationship.value.status) {
                case RelationshipStatus.Rejected:
                case RelationshipStatus.Revoked:
                case RelationshipStatus.Terminated:
                case RelationshipStatus.DeletionProposed:
                    status = "rejected";
                    break;
                case RelationshipStatus.Pending:
                    status = "onboarding";
                    break;
                case RelationshipStatus.Active:
                    status = "active";
                    break;
            }
        }

        if (!student.correspondingRelationshipTemplateId) {
            status = "deleted";
        }

        return { ...student.toJSON(), status: status };
    }

    public async getStudentFiles(student: Student): Promise<SchoolFileDTO[]> {
        if (!student.correspondingRelationshipId) return [];

        const relationshipResult = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId.toString() });

        const requestsResult = await this.services.consumptionServices.outgoingRequests.getRequests({
            query: {
                peer: relationshipResult.value.peer,
                "content.items.@type": "TransferFileOwnershipRequestItem"
            }
        });

        const requests = requestsResult.value;

        const requestsWithOnlyOneTransferFileOwnershipRequestItem = requests.filter((request) => {
            return request.content.items.length === 1 && request.content.items[0]["@type"] === "TransferFileOwnershipRequestItem";
        });

        const files = await Promise.all(
            requestsWithOnlyOneTransferFileOwnershipRequestItem.map(async (request) => {
                const file = await this.requestToFileDVO(request);
                return file;
            })
        );

        return files;
    }

    private async requestToFileDVO(request: LocalRequestDTO): Promise<SchoolFileDTO> {
        const requestItem = request.content.items[0] as TransferFileOwnershipRequestItemJSON;

        const file = await this.services.transportServices.files.getOrLoadFile({ reference: requestItem.fileReference });

        const responseItem = request.response?.content.items[0] as TransferFileOwnershipAcceptResponseItemJSON | RejectResponseItemJSON | undefined;

        const status = ((result?: ResponseItemResult) => {
            if (!result) return "pending";
            if (result === ResponseItemResult.Accepted) return "accepted";
            return "rejected";
        })(responseItem?.result);

        return {
            filename: file.value.filename,
            status: status,
            fileSentAt: request.createdAt,
            respondedAt: request.response?.createdAt
        };
    }
}
