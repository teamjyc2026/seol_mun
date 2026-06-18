import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { claudeJson, llmErrorMessage } from '@/shared/config/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  text: z.string().trim().min(1).max(20_000),
  subject: z.string().max(50).optional(),
});

/** 지문을 자연스러운 한국어 해석으로 — 해설지에 해석이 없을 때 수동 생성용. */
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
    const result = await claudeJson<{ translation: string }>({
      onUsage: (u) => {
        usage = u;
      },
      system: `너는 ${body.subject ?? '영어'} 지문 번역 전문가다. 주어진 지문을 자연스러운 한국어로 번역·해석하라.
- 의역 OK. 한국 학생이 이해하기 쉬운 매끄러운 한국어로.
- 군더더기 설명·해설·머리말 없이 **해석문(번역)만** 출력하라.
- 문단 구분은 살려라.`,
      content: [{ type: 'text', text: body.text }],
      schema: {
        type: 'object',
        properties: { translation: { type: 'string' } },
        required: ['translation'],
        additionalProperties: false,
      },
      maxTokens: 4096,
    });
    return NextResponse.json({ translation: result.translation ?? '', usage });
  } catch (e) {
    return NextResponse.json({ message: llmErrorMessage(e) }, { status: 500 });
  }
}
