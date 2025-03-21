import { MongoDbCollection, MongoDbCollectionProvider } from "@js-soft/docdb-access-mongo";
import { ApplicationError, Result } from "@js-soft/ts-utils";
import { LocalAttributeJSON } from "@nmshd/consumption";
import { DisplayNameJSON, RelationshipTemplateContentJSON, RequestJSON, ShareAttributeRequestItemJSON } from "@nmshd/content";
import { CoreDate } from "@nmshd/core-types";
import { RelationshipStatus, RuntimeServices } from "@nmshd/runtime";
import fs from "node:fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import qrCodeLib from "qrcode";
import { Student, StudentDTO, StudentStatus } from "./types";

export class StudentsController {
    #studentsCollection: MongoDbCollection;

    public constructor(
        public readonly displayName: LocalAttributeJSON,
        private readonly services: RuntimeServices,
        private readonly database: MongoDbCollectionProvider,
        private readonly assetsLocation: string
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
        additionalConsents: { title: string; mustBeAccepted?: boolean; consent: string; link: string }[];
    }): Promise<Student> {
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
                        } satisfies ShareAttributeRequestItemJSON
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
                    link: consent.link
                }))
            });
        }

        const template = await this.services.transportServices.relationshipTemplates.createOwnRelationshipTemplate({
            maxNumberOfAllocations: 1,
            content: { "@type": "RelationshipTemplateContent", onNewRelationship: request } satisfies RelationshipTemplateContentJSON,
            expiresAt: CoreDate.utc().add({ years: 1 }).toISOString(),
            passwordProtection: data.pin ? { password: data.pin, passwordIsPin: true } : undefined
        });

        const student = Student.from({ id: data.id, givenname: data.givenname, surname: data.surname, correspondingRelationshipTemplateId: template.value.id });

        await this.#studentsCollection.create(student.toJSON());

        return student;
    }

    public async getOnboardingDataForStudent(student: Student): Promise<Result<{ pdf: Buffer; png: Buffer; link: string }>> {
        const template = await this.services.transportServices.relationshipTemplates.getRelationshipTemplate({ id: student.correspondingRelationshipTemplateId.toString() });
        if (template.isError) return Result.fail(template.error);

        const link = `nmshd://tr#${template.value.truncatedReference}`;

        const pngAsBuffer = await qrCodeLib.toBuffer(link, { type: "png" });

        const onboardingPdf = await this.createOnboardingPDF(
            {
                organizationDisplayName: (this.displayName.content.value as DisplayNameJSON).value,
                name: `${student.givenname} ${student.surname}`,
                givenname: student.givenname,
                surname: student.surname,
                templateReference: template.value.truncatedReference
            },
            pngAsBuffer
        );

        return Result.ok({ link: link, png: pngAsBuffer, pdf: onboardingPdf });
    }

    private async createOnboardingPDF(data: { organizationDisplayName: string; name: string; givenname: string; surname: string; templateReference: string }, pngAsBuffer: Buffer) {
        const formPdfBytes = await fs.promises.readFile(path.resolve(path.join(this.assetsLocation, "template_onboarding.pdf")));
        const pdfDoc = await PDFDocument.load(formPdfBytes);

        const qrImage = await pdfDoc.embedPng(pngAsBuffer);
        const form = pdfDoc.getForm();

        form.getTextField("CharacterName 2").setText(`${data.givenname} ${data.surname}`);
        form.getTextField("Allies").setText(data.organizationDisplayName);
        form.getButton("CHARACTER IMAGE").setImage(qrImage);
        // form.getTextField('Vorname').setText(data.givenname);
        // form.getTextField('Nachname').setText(data.surname);

        form.flatten();
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

    public async getStudentByRelationshipId(relationshipId: string): Promise<Student> {
        const doc = await this.#studentsCollection.findOne({ correspondingRelationshipId: relationshipId });
        return Student.from(doc);
    }

    public async updateStudent(student: Student): Promise<void> {
        const oldDoc = await this.#studentsCollection.read(student.id.toString());

        await this.#studentsCollection.update(oldDoc, student.toJSON());
    }

    public async deleteStudent(student: Student): Promise<void> {
        await this.#studentsCollection.delete({ id: student.id.toString() });
    }

    public async existsStudent(id: string): Promise<boolean> {
        return await this.#studentsCollection.exists({ id: id });
    }

    public async sendFile(student: Student, data: { file: string; title: string; filename: string; mimetype: string; tags?: string[] | undefined }): Promise<void> {
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
                    // TODO: switch to TransferFileOwnershipRequestItem when the app supports it
                    // { "@type": "TransferFileOwnershipRequestItem", mustBeAccepted: true, fileReference: file.value.truncatedReference },
                    {
                        "@type": "CreateAttributeRequestItem",
                        title: "Abiturzeugnis",
                        mustBeAccepted: true,
                        attribute: {
                            "@type": "IdentityAttribute",
                            tags: data.tags,
                            owner: "",
                            value: { "@type": "IdentityFileReference", value: file.value.truncatedReference }
                        }
                    }
                ]
            },
            peer: relationship.value.peer
        });

        await this.services.transportServices.messages.sendMessage({ content: request.value.content, recipients: [relationship.value.peer] });
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

        return { ...student.toJSON(), status: status };
    }
}
