import { z } from 'zod';

/** 클라이언트 → 서버 제출 페이로드. 점수/유형은 서버가 answers로 재계산한다. */
export const enneagramPayloadSchema = z.object({
  info: z.object({
    name: z.string().trim().min(1, '이름을 입력해 주세요').max(50),
    school: z.string().trim().max(100).optional().default(''),
    grade: z.string().trim().max(30).optional().default(''),
    phone: z.string().trim().max(30).optional().default(''),
  }),
  answers: z.record(
    z.string(),
    z.array(z.number().int().min(1).max(5)).length(15),
  ),
});

export type EnneagramPayload = z.infer<typeof enneagramPayloadSchema>;
