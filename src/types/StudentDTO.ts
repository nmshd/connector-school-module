export type StudentStatus = "onboarding" | "rejected" | "active" | "deleted";

export interface StudentDTO {
    id: string;
    givenname?: string;
    surname?: string;
    correspondingRelationshipTemplateId?: string;
    correspondingRelationshipId?: string;
    status: StudentStatus;
}

export interface StudentLog {
    entries: StudentLogEntry[];
}

export interface StudentLogEntry {
    time: string;
    log: string;
    id: string;
    object?: any;
}
