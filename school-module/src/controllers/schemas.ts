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
