import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { claudeJson, llmErrorMessage } from '@/shared/config/anthropic';
import { topicCategoriesFor } from '@/shared/config/topics';

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
  passage?: string;
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
  /** 분류(대분류) — 과목 분류 목록에서 고름. */
  category?: string;
  topic?: string;
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
    const problem = await claudeJson<OcrProblem>({
      onUsage: (u) => {
        usage = u;
      },
      system: `너는 한국 고등학교 시험지 디지털화 전문가다. 이미지 속 문제 1개를 구조화 추출하라.
- question: 발문(번호 제외). 지문이 있으면 발문만 넣고 지문은 passage에.
- passage: 지문/제시문 전체. 밑줄 친 어구는 "ⓐ **word**" 형태로, 네모 선택은 "[which / that]", 빈칸은 "______"로 표기 유지.
- choices: 객관식이면 보기 전부 (label "①"~"⑤"), 아니면 생략.
- answer/explanation: 이미지에 정답·해설이 보일 때만 채우고, 안 보이면 생략(빈칸으로 두면 관리자가 기입).
- problem_type: objective(객관식)|short(단답)|long(서술) 추정.
- category와 topic은 위 [분류 목록]에서 정확히 골라라.${taxonomyText}
- 글자는 보이는 그대로, 요약·번역 금지.`,
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: body.mediaType, data: body.image },
        },
        { type: 'text', text: '이 영역의 문제를 구조화 추출하라.' },
      ],
      schema: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          question: { type: 'string' },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                text: { type: 'string' },
              },
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
      maxTokens: 8192,
    });
    return NextResponse.json({ problem, usage });
  } catch (e) {
    return NextResponse.json(
      { message: llmErrorMessage(e) },
      { status: 500 },
    );
  }
}
