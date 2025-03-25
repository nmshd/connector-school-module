import { ApplicationError, Result } from "@js-soft/ts-utils";
import { Envelope } from "@nmshd/connector-types";
import { RuntimeErrors } from "@nmshd/runtime";
import { Inject } from "@nmshd/typescript-ioc";
import { Accept, GET, Path, PathParam, POST } from "@nmshd/typescript-rest";
import { fromError } from "zod-validation-error";
import { StudentsController } from "../StudentsController";
import { Student, StudentOnboardingDTO } from "../types";
import { createStudentRequestSchema, sendAbiturzeugnisRequestSchema, sendFileRequestSchema } from "./schemas";

@Path("/students")
export class StudentsRESTController {
    public constructor(@Inject private readonly studentsController: StudentsController) {}

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
    @Path(":id/onboarding")
    @Accept("application/json")
    public async getStudentOnboarding(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const onboardingData = (await this.studentsController.getOnboardingDataForStudent(id)) satisfies StudentOnboardingDTO;
        return this.ok(Result.ok(onboardingData));
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

    protected ok<T>(result: Result<T>): Envelope {
        return this.json(result);
    }

    private json<T>(result: Result<T>): Envelope {
        this.guard(result);
        return Envelope.ok(result.value);
    }

    private guard<T>(result: Result<T>) {
        if (result.isError) {
            throw result.error;
        }
    }
}
