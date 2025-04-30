export interface SchoolFileDTO {
    filename: string;
    status: "pending" | "accepted" | "rejected";
    fileSentAt: string;
    anweredAt?: string;
}
