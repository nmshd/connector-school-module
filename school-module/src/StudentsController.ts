import { MongoDbCollection, MongoDbCollectionProvider } from "@js-soft/docdb-access-mongo";
import { ApplicationError } from "@js-soft/ts-utils";
import { LocalAttributeJSON } from "@nmshd/consumption";
import { RelationshipTemplateContentJSON, RequestJSON, ShareAttributeRequestItemJSON } from "@nmshd/content";
import { CoreDate } from "@nmshd/core-types";
import { RelationshipTemplateDTO, RuntimeServices } from "@nmshd/runtime";
import { OnboardingData, OnboardingPDFData, Student, StudentDTO, StudentStatus } from "./types";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "path";
import QRCode from "qrcode";

export class StudentsController {
    #studentsCollection: MongoDbCollection;

    public constructor(
        public readonly displayName: LocalAttributeJSON,
        private readonly services: RuntimeServices,
        private readonly database: MongoDbCollectionProvider
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
        additionalConsents: Array<{ title: string; mustBeAccepted?: boolean; consent: string; link: string }>;
    }): Promise<{ student: Student; template: RelationshipTemplateDTO; onboardingData: OnboardingData }> {
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

        this.#studentsCollection.create(student.toJSON());

        return { student, template: template.value, onboardingData: await this.getOnboardingDataForStudent(data.id) };
    }

    public async getOnboardingDataForStudent(id:string) {
        const student = await this.getStudent(id);
        if (!student) throw new ApplicationError("error.schoolModule.unknownStudent", "The student does not exist.");

        const template = await this.services.transportServices.relationshipTemplates.getRelationshipTemplate({id: student.correspondingRelationshipTemplateId.toString()} );
        if (template.isError) {
            throw template.error;
        }

        const link = `nmshd://qr#${template.value.truncatedReference}`
        const base64image = await QRCode.toDataURL(link, { type: "image/png" });
        // Starts with "data:image/png;base64,"
        const image = Buffer.from(base64image.substring(22, base64image.length - 1), "base64");

        const onboardingPdfAsBase64 = await this.createOnboardingPDF({
            organization_display_name: "" + (this.displayName.content.value as any).value,
            name: `${student.givenname} ${student.surname}`,
            givenname: student.givenname,
            surname: student.surname,
            templateReference: template.value.truncatedReference
        },
        image);

        const data:OnboardingData = {
            link: link,
            png: image.toString("base64"),
            pdf: onboardingPdfAsBase64
        }

        return data
    }

    public async createOnboardingPDF(data: OnboardingPDFData, pngAsBuffer:Buffer, templatePath: string = "/usr/app/node_modules/school-module/assets/template_onboarding.pdf") {
        const formPdfBytes = await fs.promises.readFile(path.resolve("", templatePath));
        const pdfDoc = await PDFDocument.load(formPdfBytes);

        const qrImage = await pdfDoc.embedPng(pngAsBuffer);
        const form = pdfDoc.getForm();
        form.getTextField("CharacterName 2").setText(`${data.givenname} ${data.surname}`);
        form.getTextField("Allies").setText(data.organization_display_name);
        form.getButton("CHARACTER IMAGE").setImage(qrImage);
        //form.getTextField('Vorname').setText(data.givenname);
        //form.getTextField('Nachname').setText(data.surname);

        form.flatten();
        const pdfBytes = await pdfDoc.save();
        const base64 = Buffer.from(pdfBytes).toString("base64");
        await fs.promises.writeFile("/usr/app/node_modules/school-module/assets/created.pdf", pdfBytes);
        return base64;
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

    public async sendFile(student: Student, data: { file: string; title: string; filename: string; mimetype: string; tags?: string[] | undefined }) {
        if (!student.correspondingRelationshipId) throw new ApplicationError("error.schoolModule.noRelationship", "The student has no relationship.");
        const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId!.toString() });

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
            const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationshipId!.toString() });
            switch (relationship.value.status) {
                case "Rejected":
                case "Revoked":
                case "Terminated":
                case "DeletionProposed":
                    status = "rejected";
                    break;
                case "Pending":
                    status = "onboarding";
                    break;
                case "Active":
                    status = "active";
                    break;
            }
        }

        return { ...student.toJSON(), status: status };
    }
}
