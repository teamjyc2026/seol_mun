import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { claudeJson, llmErrorMessage } from '@/shared/config/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  image: z.string().min(1).max(8_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
});

/** 크롭 영역이 문제/개념/본문 중 무엇인지 분류 (워크벤치 박스 종류 자동판별). */
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
    let usage = { input: 0, output: 0 };
    const { kind } = await claudeJson<{ kind: 'problem' | 'concept' | 'passage' }>({
      onUsage: (u) => {
        usage = u;
      },
      system: `이미지 영역이 어떤 종류인지 한 가지로 분류하라.
- problem: 문제(발문·보기·정답 등 풀어야 할 문항).
- passage: 지문/제시문(영어 본문, 긴 글 등 읽기 자료).
- concept: 개념 설명/정리/요약/공식 등 학습 내용.
애매하면 가장 비중이 큰 것으로. kind만 출력.`,
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: body.mediaType, data: body.image },
        },
        { type: 'text', text: '이 영역의 종류를 분류하라.' },
      ],
      schema: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['problem', 'concept', 'passage'] } },
        required: ['kind'],
        additionalProperties: false,
      },
      maxTokens: 64,
    });
    return NextResponse.json({ kind, usage });
  } catch (e) {
    return NextResponse.json(
      { message: llmErrorMessage(e) },
      { status: 500 },
    );
  }
}
