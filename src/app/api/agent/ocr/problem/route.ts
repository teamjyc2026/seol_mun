import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { claudeJson } from '@/shared/config/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  image: z.string().min(1).max(8_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
});

export type OcrProblem = {
  passage?: string;
  question: string;
  choices?: { label: string; text: string }[];
  answer?: string;
  explanation?: string;
  problem_type: 'objective' | 'short' | 'long';
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

  try {
    const problem = await claudeJson<OcrProblem>({
      system: `너는 한국 고등학교 시험지 디지털화 전문가다. 이미지 속 문제 1개를 구조화 추출하라.
- question: 발문(번호 제외). 지문이 있으면 발문만 넣고 지문은 passage에.
- passage: 지문/제시문 전체. 밑줄 친 어구는 "ⓐ **word**" 형태로, 네모 선택은 "[which / that]", 빈칸은 "______"로 표기 유지.
- choices: 객관식이면 보기 전부 (label "①"~"⑤"), 아니면 생략.
- answer/explanation: 이미지에 정답·해설이 보일 때만 채우고, 안 보이면 생략(빈칸으로 두면 관리자가 기입).
- problem_type: objective(객관식)|short(단답)|long(서술) 추정.
- topic: 단원/주제 추정 (예: "관계대명사").
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
          topic: { type: 'string' },
        },
        required: ['question', 'problem_type'],
        additionalProperties: false,
      },
      maxTokens: 8192,
    });
    return NextResponse.json({ problem });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : '인식 실패' },
      { status: 500 },
    );
  }
}
