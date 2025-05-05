export interface StudentAuditLog extends Array<StudentAuditLogEntry> {}

export interface StudentAuditLogEntry {
    time: string;
    log: string;
    id: string;
    object?: any;
}
