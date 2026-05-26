import { z, type ZodType } from 'zod';
import { questionList } from './questions';
import type { Question } from './types';

function fieldSchema(q: Question): ZodType {
  switch (q.type) {
    case 'single':
    case 'select':
      return q.optional
        ? z.string().optional().default('')
        : z.string().min(1, '선택해 주세요.');
    case 'multi': {
      const base = z.array(z.string()).default([]);
      const refined = q.optional
        ? base
        : base.refine((v) => v.length >= 1, '하나 이상 선택해 주세요.');
      return q.maxSelect
        ? refined.refine(
            (v) => v.length <= q.maxSelect!,
            `최대 ${q.maxSelect}개까지 선택할 수 있어요.`,
          )
        : refined;
    }
    case 'short':
      return q.optional
        ? z.string().optional().default('')
        : z.string().min(1, '답변을 입력해 주세요.').max(200);
    case 'long':
      return q.optional
        ? z.string().optional().default('')
        : z.string().min(1, '답변을 입력해 주세요.').max(2000);
    case 'scale': {
      const min = q.scale?.min ?? 1;
      const max = q.scale?.max ?? 5;
      const allowEmpty = q.scale?.allowEmpty || q.optional;
      const base = z.number().int().min(min).max(max);
      return allowEmpty ? base.nullable().default(null) : base;
    }
    case 'rank': {
      const rec = z.record(z.string(), z.string()).default({});
      return rec.refine((v) => {
        const need = q.rank?.max ?? 0;
        return Object.keys(v).length === need;
      }, `${q.rank?.max}개를 순서대로 선택해 주세요.`);
    }
    default:
      return z.any();
  }
}

export const answersSchema = z.object(
  Object.fromEntries(questionList.map((q) => [q.id, fieldSchema(q)])) as Record<
    string,
    ZodType
  >,
);

export const consentSchema = z.object({
  privacy_agreed: z.literal(true, {
    error: '개인정보 수집·이용에 동의해 주세요.',
  }),
  name: z.string().min(1, '이름을 입력해 주세요.').max(50),
  phone: z
    .string()
    .min(1, '연락처를 입력해 주세요.')
    .regex(/^[0-9-+\s()]{7,20}$/, '올바른 연락처 형식이 아닙니다.'),
  affiliation: z
    .string()
    .min(1, '소속(학교/학년)을 입력해 주세요.')
    .max(100),
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
});

export const giftSchema = z.enum(['oliveyoung', 'cu'], {
  error: '상품권을 선택해 주세요.',
});

export const submissionSchema = z.object({
  answers: answersSchema,
  consent: consentSchema,
  gift: giftSchema,
});

export type AnswersForm = z.infer<typeof answersSchema>;
export type ConsentForm = z.infer<typeof consentSchema>;
export type SubmissionForm = z.infer<typeof submissionSchema>;
