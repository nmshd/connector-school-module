import { ApplicationError } from "@js-soft/ts-utils";
import { LocalAttributeJSON } from "@nmshd/consumption";
import { MailJSON, RelationshipTemplateContentJSON, RequestJSON, ShareAttributeRequestItemJSON } from "@nmshd/content";
import { CoreDate } from "@nmshd/core-types";
import { RelationshipTemplateDTO, RuntimeServices } from "@nmshd/runtime";
import { Student } from "./Student";

export class StudentsController {
    #students: Student[] = [];

    private constructor(public readonly displayName: LocalAttributeJSON, private readonly services: RuntimeServices) {}

    public static create(displayName: LocalAttributeJSON, services: RuntimeServices): StudentsController {
        return new StudentsController(displayName, services);
    }

    public async createStudent(
        id: string,
        data: {
            givenname: string;
            surname: string;
            pin?: string;
            additionalConsents: Array<{ title: string; mustBeAccepted?: boolean; consent: string; link: string }>;
        }
    ): Promise<{ student: Student; template: RelationshipTemplateDTO }> {
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

        const student = Student.from({ id: id, correspondingRelationshipTemplate: template.value.id });

        this.#students.push(student);

        return { student, template: template.value };
    }

    public async getStudents(): Promise<Student[]> {
        return this.#students;
    }

    public async getStudent(id: string): Promise<Student | undefined> {
        return this.#students.find((student) => student.id.toString() === id);
    }

    public async getStudentByTemplateId(templateId: string): Promise<Student> {
        return this.#students.find((student) => student.correspondingRelationshipTemplate.equals(templateId))!;
    }

    public async getStudentByRelationshipId(relationshipId: string): Promise<Student> {
        return this.#students.find((student) => student.correspondingRelationship?.equals(relationshipId))!;
    }

    public async updateStudent(student: Student): Promise<void> {
        const index = this.#students.findIndex((s) => s.id.toString() === student.id.toString());
        this.#students[index] = student;
    }

    public async deleteStudent(student: Student): Promise<void> {
        this.#students = this.#students.filter((s) => !s.id.equals(student.id));
    }

    public async existsStudent(id: string): Promise<boolean> {
        return this.#students.some((student) => student.id.toString() === id);
    }

    public async sendAbiturzeugnis(student: Student, data: { file: string; title?:string, filename?: string; mimetype?: string; tags?: string[] }) {
        const title = data.title ? data.title : "Abiturzeugnis"
        const filename = data.filename ? data.filename : "Abiturzeugnis.pdf"
        const mimetype = data.mimetype ? data.mimetype : "application/pdf"

        const tags = ["schulzeugnis"]
        if (data.tags) {
            tags.push(...data.tags)
        }

        await this.sendFile(student, {
            file: data.file,
            title,
            filename,
            mimetype,
            tags
        })
    }

    public async sendFile(student: Student, data: { file: string; title:string, filename: string; mimetype: string; tags?: string[] | undefined }) {
        if (!student.correspondingRelationship) throw new ApplicationError("error.schoolModule.noRelationship", "The student has no relationship.");
        const relationship = await this.services.transportServices.relationships.getRelationship({ id: student.correspondingRelationship!.toString() });

        const file = await this.services.transportServices.files.uploadOwnFile({
            content: Buffer.from(data.file, "base64"),
            tags: data.tags,
            filename: data.filename,
            mimetype: data.mimetype,
            title: data.title
        });

        /*
        const request = await this.services.consumptionServices.outgoingRequests.create({
            content: { items: [{ "@type": "TransferFileOwnershipRequestItem", mustBeAccepted: true, fileReference: file.value.truncatedReference }] },
            peer: relationship.value.peer
        });

        await this.services.transportServices.messages.sendMessage({
            content: request.value.content,
            recipients: [relationship.value.peer]
        });
        */

        
        const request = await this.services.consumptionServices.outgoingRequests.create({
            content: { items: [{ "@type": "CreateAttributeRequestItem", title:"Abiturzeugnis", mustBeAccepted: true, attribute: {
                "@type": "IdentityAttribute",
                "tags": data.tags,
                "owner": "",
                "value": {
                    "@type": "IdentityFileReference",
                    "value": file.value.truncatedReference
                }
            }}]},
            peer: relationship.value.peer
        });

        await this.services.transportServices.messages.sendMessage({
            content: request.value.content,
            recipients: [relationship.value.peer]
        });
        
/*
        await this.services.transportServices.messages.sendMessage({
            content: { "@type": "Mail", subject: "Abiturzeugnis", body: "Herzlichen Glückwunsch zu deinem Zeugnis.", to: [relationship.value.peer] } satisfies MailJSON,
            attachments: [file.value.id],
            recipients: [relationship.value.peer]
        });
        */
    }
}
