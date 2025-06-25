export type StudentStatus = "onboarding" | "rejected" | "active" | "deleted";

export interface StudentDTO {
    id: string;
    givenname?: string;
    surname?: string;
    pin?: string;
    correspondingRelationshipTemplateId?: string;
    correspondingRelationshipId?: string;
    status: StudentStatus;
}
