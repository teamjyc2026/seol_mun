import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { CLAUDE_MODEL, getAnthropic, llmErrorMessage } from '@/shared/config/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  /** base64 (data URL 헤더 제외) */
  image: z.string().min(1).max(8_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
});

/** 크롭된 이미지 영역의 글자를 Claude 비전으로 인식해 텍스트로 반환. */
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
    const client = getAnthropic();
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system:
        '이미지 속 글자를 보이는 그대로 전사(OCR)하라. 요약·번역·해설 금지. 문제 번호, 보기(①~⑤), 밑줄·기호(ⓐ~ⓔ), 빈칸(______)은 표기 그대로 유지. 표는 행 단위 텍스트로. 결과 텍스트만 출력하라.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: body.mediaType, data: body.image },
            },
            { type: 'text', text: '이 영역의 텍스트를 전사해줘.' },
          ],
        },
      ],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();
    return NextResponse.json({
      text,
      usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    });
  } catch (e) {
    return NextResponse.json(
      { message: llmErrorMessage(e) },
      { status: 500 },
    );
  }
}
