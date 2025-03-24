import { ApplicationError, Result } from "@js-soft/ts-utils";
import { Envelope } from "@nmshd/connector-types";
import { ConsumptionServices, RuntimeErrors, TransportServices } from "@nmshd/runtime";
import { Inject } from "@nmshd/typescript-ioc";
import { Accept, GET, Path, PathParam, POST } from "@nmshd/typescript-rest";
import { fromError } from "zod-validation-error";
import { Student } from "../Student";
import { StudentsController } from "../StudentsController";
import { createStudentRequestSchema, sendFileRequestSchema, sendAbiturzeugnisRequestSchema } from "./schemas";

@Path("/students")
export class StudentsRESTController {
    public constructor(
        @Inject private readonly studentsController: StudentsController,
        @Inject private readonly transportServices: TransportServices,
        @Inject private readonly consumptionServices: ConsumptionServices
    ) {}

    @POST
    @Path(":id")
    @Accept("application/json")
    public async createStudent(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const validationResult = createStudentRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        if (await this.studentsController.existsStudent(id)) {
            throw new ApplicationError("error.schoolModule.studentAlreadyExists", "The student already exists.");
        }

        const { template } = await this.studentsController.createStudent(id, data);

        return Envelope.ok({ studentId: id, templateId: template.id, qrContent: `nmshd://tr#${template.truncatedReference}` });
    }

    @GET
    @Path(":id")
    @Accept("application/json")
    public async getStudent(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        return this.ok(Result.ok(student));
    }

    @GET
    @Accept("application/json")
    public async getStudents(): Promise<Envelope> {
        const students = await this.studentsController.getStudents();
        return this.ok(Result.ok(students));
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

        return this.ok(Result.ok(student));
    }

    @POST
    @Path(":id/files/abiturzeugnis")
    @Accept("application/json")
    public async sendAbiturzeugnis(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const student = await this.studentsController.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        const validationResult = sendAbiturzeugnisRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        await this.studentsController.sendAbiturzeugnis(student, data);

        return this.ok(Result.ok(student));
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
