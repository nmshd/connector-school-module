import { z } from "zod";

export const createStudentRequestSchema = z.object({
    pin: z
        .string()
        .regex(/^[0-9]{4,16}$/, "a pin must be 4-16 digits")
        .optional(),
    givenname: z.string().min(1).max(64),
    surname: z.string().min(1).max(64),
    additionalConsents: z
        .array(
            z.object({
                title: z.string().min(1).max(64),
                mustBeAccepted: z.boolean().optional(),
                consent: z.string().min(1).max(64),
                link: z.string().url()
            })
        )
        .optional()
        .default([])
});

export const sendFileRequestSchema = z.object({
    file: z.string().base64(),
    filename: z.string().min(5).max(255),
    mimetype: z.string(),
    tags: z.array(z.string()).optional()
});
