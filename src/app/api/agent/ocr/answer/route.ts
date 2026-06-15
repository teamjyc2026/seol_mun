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
  /** 어떤 문제의 정답을 찾는지 힌트 (발문 일부 등) */
  hint: z.string().max(500).optional(),
});

/** 답안지/해설 영역에서 정답과 해설을 추출 — 보조 뷰어의 "정답·해설 가져오기". */
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
    const result = await claudeJson<{ answer?: string; explanation?: string }>({
      onUsage: (u) => {
        usage = u;
      },
      system: `너는 시험지 답안·해설 디지털화 전문가다. 이미지 영역에서 정답과 해설을 추출하라.
- answer: 정답. 객관식이면 번호만 ("①"~"⑤" 형식), 주관식이면 정답 텍스트.
- explanation: 해설 전체 (보이는 그대로, 요약 금지). 없으면 생략.
- 영역에 여러 문제의 답이 있으면${body.hint ? ' 힌트에 해당하는 문제의 것만' : ' 가장 위(첫 번째) 문제의 것만'} 추출하라.
${body.hint ? `힌트(대상 문제): ${body.hint}` : ''}`,
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: body.mediaType, data: body.image },
        },
        { type: 'text', text: '이 영역에서 정답과 해설을 추출하라.' },
      ],
      schema: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          explanation: { type: 'string' },
        },
        additionalProperties: false,
      },
      maxTokens: 4096,
    });
    return NextResponse.json({ ...result, usage });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : '인식 실패' },
      { status: 500 },
    );
  }
}
