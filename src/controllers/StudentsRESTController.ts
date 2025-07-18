import { ApplicationError, Result } from "@js-soft/ts-utils";
import { BaseController, Envelope, Mimetype } from "@nmshd/connector-types";
import { RuntimeErrors } from "@nmshd/runtime";
import { Inject } from "@nmshd/typescript-ioc";
import { Accept, ContextAccept, ContextResponse, DELETE, GET, Path, PathParam, POST, QueryParam } from "@nmshd/typescript-rest";
import express from "express";
import { fromError } from "zod-validation-error/v4";
import { buildInformation } from "../buildInformation";
import { StudentsController } from "../StudentsController";
import { Student, StudentAuditLog, StudentOnboardingDTO } from "../types";
import { createStudentOnboardingPDFSchema, createStudentRequestSchema, sendAbiturzeugnisRequestSchema, sendFileRequestSchema, sendMailRequestSchema } from "./schemas";

@Path("/students")
export class StudentsRESTController extends BaseController {
    public constructor(@Inject private readonly studentsController: StudentsController) {
        super();
    }

    @GET
    @Path("version")
    @Accept("application/json")
    public getVersion(): any {
        return buildInformation;
    }

    @POST
    @Accept("application/json")
    public async createStudent(body: any): Promise<Envelope> {
        const validationResult = createStudentRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        if (await this.studentsController.existsStudent(data.id)) {
            throw new ApplicationError("error.schoolModule.studentAlreadyExists", "The student already exists.");
        }

        const student = await this.studentsController.createStudent(data);

        const dto = await this.studentsController.toStudentDTO(student);

        return Envelope.ok(dto);
    }

    @GET
    @Path(":id")
    @Accept("application/json")
    public async getStudent(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const dto = await this.studentsController.toStudentDTO(student);
        return this.ok(Result.ok(dto));
    }

    @GET
    @Path(":id/log")
    @Accept("application/json", "text/plain")
    public async getStudentLog(
        @PathParam("id") id: string,
        @ContextAccept accept: string,
        @ContextResponse response: express.Response,
        @QueryParam("verbose") verbose?: boolean
    ): Promise<Envelope | void> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const auditLog = await this.studentsController.getStudentAuditLog(student, verbose);

        switch (accept) {
            case "text/plain":
                response.status(200).send(auditLog.map((entry) => `For ${entry.id} at ${entry.time} : ${entry.log}`).join("\n"));
                return;

            default:
                return this.ok<StudentAuditLog>(Result.ok(auditLog));
        }
    }

    @DELETE
    @Path(":id")
    public async deleteStudent(@PathParam("id") id: string): Promise<void> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        await this.studentsController.deleteStudent(student);
        return this.noContent(Result.ok<unknown, ApplicationError>(undefined));
    }

    @POST
    @Path(":id/onboarding")
    @Accept("application/pdf")
    public async createStudentOnboardingPDF(@PathParam("id") id: string, @ContextResponse response: express.Response, body: any): Promise<Envelope | void> {
        const validationResult = createStudentOnboardingPDFSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const result = await this.studentsController.getOnboardingDataForStudent(student, data);
        return this.file(
            result,
            (r) => r.value.pdf,
            () => `${id}_onboarding.pdf`,
            () => Mimetype.pdf(),
            response,
            200
        );
    }

    @GET
    @Path(":id/onboarding")
    @Accept("application/json", "application/pdf", "image/png")
    public async getStudentOnboarding(@PathParam("id") id: string, @ContextAccept accept: string, @ContextResponse response: express.Response): Promise<Envelope | void> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const result = await this.studentsController.getOnboardingDataForStudent(student, {});

        switch (accept) {
            case "application/pdf":
                return this.file(
                    result,
                    (r) => r.value.pdf,
                    () => `${id}_onboarding.pdf`,
                    () => Mimetype.pdf(),
                    response,
                    200
                );
            case "image/png":
                return this.file(
                    result,
                    (r) => r.value.png,
                    () => `${id}_onboarding.png`,
                    () => Mimetype.png(),
                    response,
                    200
                );
            default:
                return this.ok<StudentOnboardingDTO>(
                    Result.ok({
                        link: result.value.link,
                        pdf: result.value.pdf.toString("base64"),
                        png: result.value.png.toString("base64")
                    })
                );
        }
    }

    @GET
    @Accept("application/json")
    public async getStudents(): Promise<Envelope> {
        const students = await this.studentsController.getStudents();

        const dtoPromises = students.map((student) => this.studentsController.toStudentDTO(student));
        const dtos = await Promise.all(dtoPromises);

        return this.ok(Result.ok(dtos));
    }

    @POST
    @Path(":id/mails")
    @Accept("application/json")
    public async sendMail(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const validationResult = sendMailRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        const mail = await this.studentsController.sendMail(student, data.subject, data.body);

        return Envelope.ok(mail);
    }

    @GET
    @Path(":id/mails")
    public async getStudentMails(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const mails = await this.studentsController.getMails(student);
        return this.ok(Result.ok(mails));
    }

    @POST
    @Path(":id/mails/:templateName")
    @Accept("application/json")
    public async sendMailBasedOnNamedTemplate(@PathParam("id") id: string, @PathParam("templateName") templateName: string, body: any): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const mail = await this.studentsController.sendMailBasedOnTemplateName(student, templateName, body);
        return Envelope.ok(mail);
    }

    @GET
    @Path(":id/files")
    @Accept("application/json")
    public async getStudentFiles(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const files = await this.studentsController.getStudentFiles(student);
        return this.ok(Result.ok(files));
    }

    @POST
    @Path(":id/files")
    @Accept("application/json")
    public async sendFile(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const validationResult = sendFileRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        const fileDTO = await this.studentsController.sendFile(student, data);
        return this.ok(Result.ok(fileDTO));
    }

    @POST
    @Path(":id/files/abiturzeugnis")
    @Accept("application/json")
    public async sendAbiturzeugnis(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const validationResult = sendAbiturzeugnisRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);

        const tags = new Set(validationResult.data.tags ?? []);
        tags.add("language:de");
        tags.add("mimetype:application/pdf");

        // Allgemeine Hochschulreife
        tags.add("urn:xbildung-de:destatis:codeliste:artdesschulabschlusses=http://xbildung.de/def/destatis/1.0/code/artdesschulabschlusses/allgemeine_hochschulreife");

        // Zeugnisart / Abschlusszeugnis
        tags.add("urn:xschule-digital:xschule:codeliste:zeugnisart=http://xschule.digital/def/xschule/0.5/code/zeugnisart/abschlusszeugnis");

        // ISCED Tags, siehe https://www.datenportal.bmbf.de/portal/de/G293.html
        // ISCED 3 Sekundarbereich II
        // tags.add("urn:xbildung-de:unesco:codeliste:isced2011=3");
        // ISCED 34 allgemeinbildend
        // tags.add("urn:xbildung-de:unesco:codeliste:isced2011=34");
        // ISCED 344 Gymnasien (Oberstufe)
        // tags.add("urn:xbildung-de:unesco:codeliste:isced2011=344");

        // Gymnasium
        // Art der Schule: https://www.xrepository.de/api/xrepository/urn:xbildung-de:kmk:codeliste:artderschule_1.0:technischerBestandteilGenericode
        // tags.add("urn:xbildung-de:kmk:codeliste:artderschule=https://www.xbildung.de/def/kmk/kds/4.0/code/artderschule/100");

        // seems to be the same as above in another version
        // tags.add("urn:xbildung-de:kmk:codeliste:artderschule=http://xbildung.de/def/kmk/1.0/code/artderschule/gymnasium");

        // Bundesland: https://www.xrepository.de/api/xrepository/urn:de:bund:destatis:bevoelkerungsstatistik:schluessel:bundesland_2010-04-01:technischerBestandteilGenericode
        tags.add("urn:de:bund:destatis:bevoelkerungsstatistik:schluessel:bundesland=05");

        const data = {
            title: "Digitale Zeugnisausfertigung",
            filename: "Digitale_Zeugnisausfertigung.pdf",
            mimetype: "application/pdf",
            ...validationResult.data,
            tags: Array.from(tags)
        };

        const fileDTO = await this.studentsController.sendFile(student, data);
        return this.ok(Result.ok(fileDTO));
    }
}
