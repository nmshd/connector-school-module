import { ApplicationError, Result } from "@js-soft/ts-utils";
import { BaseController, Envelope, Mimetype } from "@nmshd/connector-types";
import { RuntimeErrors } from "@nmshd/runtime";
import { Inject } from "@nmshd/typescript-ioc";
import { Accept, ContextAccept, ContextResponse, DELETE, GET, Path, PathParam, POST } from "@nmshd/typescript-rest";
import express from "express";
import { fromError } from "zod-validation-error";
import { StudentsController } from "../StudentsController";
import { Student, StudentOnboardingDTO } from "../types";
import { createStudentRequestSchema, sendAbiturzeugnisRequestSchema, sendFileRequestSchema } from "./schemas";

@Path("/students")
export class StudentsRESTController extends BaseController {
    public constructor(@Inject private readonly studentsController: StudentsController) {
        super();
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

    @DELETE
    @Path(":id")
    public async deleteStudent(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        await this.studentsController.deleteStudent(student);
        return this.ok(Result.ok(undefined));
    }

    @GET
    @Path(":id/onboarding")
    @Accept("application/json", "application/pdf", "image/png")
    public async getStudentOnboarding(@PathParam("id") id: string, @ContextAccept accept: string, @ContextResponse response: express.Response): Promise<Envelope | void> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const result = await this.studentsController.getOnboardingDataForStudent(student);

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
    @Path(":id/files")
    @Accept("application/json")
    public async sendFile(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const validationResult = sendFileRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        await this.studentsController.sendFile(student, data);

        const dto = await this.studentsController.toStudentDTO(student);
        return this.ok(Result.ok(dto));
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
        tags.add("schulzeugnis");
        tags.add("abiturzeugnis");

        const data = { title: "Abiturzeugnis", filename: "Abiturzeugnis.pdf", mimetype: "application/pdf", ...validationResult.data, tags: Array.from(tags) };
        await this.studentsController.sendFile(student, data);

        const dto = await this.studentsController.toStudentDTO(student);
        return this.ok(Result.ok(dto));
    }
}
