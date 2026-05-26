import { z } from 'zod';

export const responsePayloadSchema = z.object({
  answers: z.record(z.string(), z.any()),
  consent: z.object({
    privacy_agreed: z.literal(true),
    name: z.string().min(1).max(50),
    phone: z.string().min(1).max(20),
    affiliation: z.string().min(1).max(100),
    email: z.string().email(),
  }),
  gift: z.enum(['oliveyoung', 'cu']),
});

export type ResponsePayload = z.infer<typeof responsePayloadSchema>;
