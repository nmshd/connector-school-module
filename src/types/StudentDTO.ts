import { SchoolFileDTO } from "./SchoolFileDTO";

export type StudentStatus = "onboarding" | "rejected" | "active" | "deleted";

export interface StudentDTO {
    id: string;
    givenname?: string;
    surname?: string;
    correspondingRelationshipTemplateId?: string;
    correspondingRelationshipId?: string;
    status: StudentStatus;
    files: SchoolFileDTO[];
}
