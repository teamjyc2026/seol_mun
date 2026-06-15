import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { claudeJson, llmErrorMessage } from '@/shared/config/anthropic';
import { topicCategoriesFor } from '@/shared/config/topics';
import { MARKUP_RULES } from '@/shared/config/markup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  image: z.string().min(1).max(8_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  /** 분류 목록을 좁히기 위한 과목 (없으면 자유 추정). */
  subject: z.string().max(50).optional(),
});

export type OcrProblem = {
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
  /** 분류(대분류) — 과목 분류 목록에서 고름. */
  category?: string;
  topic?: string;
};

/** 한 영역 인식 결과 — 공유 지문 + 그 아래 문제 여러 개. */
export type OcrProblemResult = {
  passage?: string;
  passage_translation?: string;
  problems: OcrProblem[];
};

/** PDF 워크벤치: 박스 영역 이미지를 구조화된 문제(지문/발문/보기/정답)로 인식. */
export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }

  const taxonomy = body.subject ? topicCategoriesFor(body.subject) : [];
  const taxonomyText = taxonomy.length
    ? `\n[분류 목록 — category/topic은 반드시 아래에서 골라라. 자유 입력 금지. 마땅한 게 없으면 가장 가까운 것]\n${taxonomy
        .map((c) => `· ${c.category}: ${c.topics.join(', ')}`)
        .join('\n')}`
    : '\n- category/topic: 단원·유형 추정 (예: "관계대명사").';

  try {
    let usage = { input: 0, output: 0 };
    const result = await claudeJson<OcrProblemResult>({
      onUsage: (u) => {
        usage = u;
      },
      system: `너는 한국 고등학교 시험지 디지털화 전문가다. 이미지 영역에서 공유 지문(있으면)과 그 영역의 문제를 **전부** 구조화 추출하라.
- passage: 여러 문제가 공유하는 지문/제시문 전체 (예 "[5~6] 다음 글을 읽고…"의 지문). 지문이 없으면 생략.
- passage_translation: 지문의 한국어 해석이 보이면 그 전체. 없으면 생략.
- problems: 이 영역의 문제를 **각각** 배열로. 문제가 1개면 1개, [5~6]처럼 여러 개면 그 수만큼.
  각 문제: question(발문, 번호 제외), choices(객관식이면 보기 전부 label "①"~), answer/explanation(보일 때만), problem_type(objective|short|long), category/topic(아래 목록에서).
- category와 topic은 [분류 목록]에서 정확히 골라라.${taxonomyText}
- 글자는 보이는 그대로, 요약·번역 금지.
${MARKUP_RULES}`,
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: body.mediaType, data: body.image },
        },
        { type: 'text', text: '이 영역의 지문과 문제 전부를 구조화 추출하라.' },
      ],
      schema: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          passage_translation: { type: 'string' },
          problems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                choices: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { label: { type: 'string' }, text: { type: 'string' } },
                    required: ['label', 'text'],
                    additionalProperties: false,
                  },
                },
                answer: { type: 'string' },
                explanation: { type: 'string' },
                problem_type: { type: 'string', enum: ['objective', 'short', 'long'] },
                category: { type: 'string' },
                topic: { type: 'string' },
              },
              required: ['question', 'problem_type'],
              additionalProperties: false,
            },
          },
        },
        required: ['problems'],
        additionalProperties: false,
      },
      maxTokens: 8192,
    });
    return NextResponse.json({ result, usage });
  } catch (e) {
    return NextResponse.json(
      { message: llmErrorMessage(e) },
      { status: 500 },
    );
  }
}
