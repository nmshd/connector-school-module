import { z } from "zod";

export const createStudentRequestSchema = z.object({
    id: z.string().min(1).max(64),
    pin: z
        .string()
        .regex(/^[0-9]{4,16}$/, "a pin must be 4-16 digits")
        .optional(),
    givenname: z.string().min(1).max(64),
    surname: z.string().min(1).max(64),
    additionalConsents: z
        .array(
            z.object({
                mustBeAccepted: z.boolean().optional(),
                consent: z.string().min(1).max(2000),
                link: z.string().url().optional(),
                linkDisplayText: z.string().min(1).max(64).optional()
            })
        )
        .optional()
        .default([])
});

export const createStudentOnboardingPDFSchema = z.object({
    logo: z
        .object({
            bytes: z.string().base64().optional(),
            x: z.number().min(0).optional(),
            y: z.number().min(0).optional(),
            maxWidth: z.number().min(0).optional(),
            maxHeight: z.number().min(0).optional()
        })
        .optional(),
    fields: z.record(z.string()).optional()
});

export const sendMailRequestSchema = z.object({
    subject: z.string().min(3).max(255),
    body: z.string().min(5).max(4000)
});

export const sendFileRequestSchema = z.object({
    file: z.string().base64(),
    title: z.string().min(5).max(255),
    filename: z.string().min(5).max(255),
    mimetype: z.string(),
    tags: z.array(z.string()).optional()
});

export const sendAbiturzeugnisRequestSchema = z.object({
    file: z.string().base64(),
    title: z.string().min(5).max(255).optional(),
    filename: z.string().min(5).max(255).optional(),
    mimetype: z.string().optional(),
    tags: z.array(z.string()).optional()
});
