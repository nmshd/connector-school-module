export interface SchoolFileDTO {
    filename: string;
    status: "pending" | "accepted" | "rejected";
    fileSentAt: string;
    respondedAt?: string;
}
