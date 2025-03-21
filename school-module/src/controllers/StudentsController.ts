import { ApplicationError, Result } from "@js-soft/ts-utils";
import { Envelope } from "@nmshd/connector-types";
import { RuntimeErrors } from "@nmshd/runtime";
import { Inject } from "@nmshd/typescript-ioc";
import { Accept, GET, Path, PathParam, POST } from "@nmshd/typescript-rest";
import { fromError } from "zod-validation-error";
import { Student } from "../Student";
import { StudentsRepository } from "../StudentsRepository";
import { createStudentRequestSchema } from "./schemas";

@Path("/students")
export class StudentsController {
    public constructor(@Inject private readonly studentsRepository: StudentsRepository) {}

    @POST
    @Path(":id")
    @Accept("application/json")
    public async createStudent(@PathParam("id") id: string, body: any): Promise<Envelope> {
        const validationResult = createStudentRequestSchema.safeParse(body);
        if (!validationResult.success) throw new ApplicationError("error.schoolModule.invalidRequest", `The request is invalid: ${fromError(validationResult.error)}`);
        const data = validationResult.data;

        if (await this.studentsRepository.existsStudent(id)) {
            throw new ApplicationError("error.schoolModule.studentAlreadyExists", "The student already exists.");
        }

        const { template } = await this.studentsRepository.createStudent(id, data);

        return Envelope.ok({ studentId: id, templateId: template.id, qrContent: `nmshd://tr#${template.truncatedReference}` });
    }

    @GET
    @Path(":id")
    @Accept("application/json")
    public async getStudent(@PathParam("id") id: string): Promise<Envelope> {
        const student = await this.studentsRepository.getStudent(id);
        if (!student) throw RuntimeErrors.general.recordNotFound(Student);

        return this.ok(Result.ok(student));
    }

    @GET
    @Accept("application/json")
    public async getStudents(): Promise<Envelope> {
        const students = await this.studentsRepository.getStudents();
        return this.ok(Result.ok(students));
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
