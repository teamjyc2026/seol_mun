import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { claudeJson, llmErrorMessage } from '@/shared/config/anthropic';
import { MARKUP_RULES } from '@/shared/config/markup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  image: z.string().min(1).max(8_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  /** 어떤 문제의 정답을 찾는지 힌트 (발문 일부 등) */
  hint: z.string().max(500).optional(),
  /** 객관식 보기 — 정답을 번호(①…)로 정확히 돌려주도록 모델에 제공. */
  choices: z
    .array(z.object({ label: z.string().max(8), text: z.string().max(500) }))
    .max(12)
    .optional(),
  /** 단답형 다중 빈칸(어법 선택 등) — 빈칸 수. 1보다 크면 정답을 그 수만큼 줄바꿈으로. */
  blanks: z.coerce.number().int().min(1).max(20).optional(),
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
    const result = await claudeJson<{
      answer?: string;
      explanation?: string;
      passage_translation?: string;
    }>({
      onUsage: (u) => {
        usage = u;
      },
      system: `너는 시험지 답안·해설 디지털화 전문가다. 이미지 영역에서 정답·해설·지문 해석을 추출하라.
- answer: 정답. 객관식이면 번호만 ("①"~"⑤" 형식), 주관식이면 정답 텍스트.
- explanation: 해설 전체 (보이는 그대로, 요약 금지). 없으면 생략.
- passage_translation: 지문(영어 본문 등)의 한국어 해석/번역이 보이면 그 전체. 해설과 별개. 없으면 생략.
- 영역에 여러 문제의 답이 있으면${body.hint ? ' 힌트에 해당하는 문제의 것만' : ' 가장 위(첫 번째) 문제의 것만'} 추출하라.
${body.hint ? `힌트(대상 문제): ${body.hint}` : ''}
${
  body.choices?.length
    ? `이 문제의 보기: ${body.choices.map((c) => `${c.label} ${c.text}`).join(' / ')}
정답이 보기 중 하나면 반드시 그 보기의 번호(${body.choices.map((c) => c.label).join('·')})로만 answer를 채워라. 해설에 정답 단어만 적혀 있어도 보기와 대조해 번호로 바꿔라.`
    : ''
}
${
  body.blanks && body.blanks > 1
    ? `이 문제는 정답이 ${body.blanks}개다(어법/어휘 선택 등 빈칸 여러 개). 첫 칸만 X — 각 자리의 정답을 등장 순서대로 줄바꿈(\\n)으로 정확히 ${body.blanks}개를 answer에 넣어라.`
    : ''
}
${MARKUP_RULES}`,
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: body.mediaType, data: body.image },
        },
        { type: 'text', text: '이 영역에서 정답·해설·지문 해석을 추출하라.' },
      ],
      schema: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          explanation: { type: 'string' },
          passage_translation: { type: 'string' },
        },
        additionalProperties: false,
      },
      maxTokens: 4096,
    });
    return NextResponse.json({ ...result, usage });
  } catch (e) {
    return NextResponse.json(
      { message: llmErrorMessage(e) },
      { status: 500 },
    );
  }
}
