export type StudentStatus = "onboarding" | "rejected" | "active";

export interface StudentDTO {
    id: string;
    givenname: string;
    surname: string;
    correspondingRelationshipTemplateId: string;
    correspondingRelationshipId?: string;
    status: StudentStatus;
}
