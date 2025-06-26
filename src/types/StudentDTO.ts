export type StudentStatus = "onboarding" | "rejected" | "active" | "deleted";

export interface StudentDTO {
    id: string;
    givenname?: string;
    surname?: string;
    pin?: string;
    emailSchool?: string;
    emailPrivate?: string;
    correspondingRelationshipTemplateId?: string;
    correspondingRelationshipId?: string;
    status: StudentStatus;
}
