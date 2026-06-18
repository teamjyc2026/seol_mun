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
  image: z.string().min(1).max(8_000_000).optional(),
  /** 한 문제가 여러 영역/페이지로 나뉜 경우 — 순서대로 이어붙여 한 문제로. */
  images: z.array(z.string().min(1).max(8_000_000)).min(1).max(8).optional(),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  /** 분류 목록을 좁히기 위한 과목 (없으면 자유 추정). */
  subject: z.string().max(50).optional(),
  /** 문제 세트 — 문항을 가급적 잘게(번호별로) 별도 문제로 분리. */
  split: z.boolean().optional(),
  /** 사용자가 지정한 문항 수 — problems를 정확히 이 개수로 분리. */
  expectCount: z.coerce.number().int().min(1).max(20).optional(),
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
  const imgs = body.images?.length ? body.images : body.image ? [body.image] : [];
  if (imgs.length === 0) {
    return NextResponse.json({ message: 'image 또는 images 필요' }, { status: 400 });
  }
  const merged = imgs.length > 1;

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
- 어법/어휘 선택형(한 발문 안에 네모나 번호 밑줄 택1이 **여러 번** 나오는 형태, 예 "다음 네모 안에서 어법상 알맞은 것을 고르시오"): choices로 쪼개지 말고 **problem_type='short'(다중 빈칸)** 으로 두고, answer에 각 자리의 정답을 **등장 순서대로 줄바꿈(\\n)** 으로 모두 넣어라(보일 때만). 발문엔 그 네모를 <box>…</box>, 번호 밑줄을 <u n="1">…</u>로 그대로 표시.${
  body.expectCount
    ? `\n- [문항 수 지정] 이 영역엔 문항이 **정확히 ${body.expectCount}개** 있다. problems 배열을 반드시 ${body.expectCount}개로 만들어라 — 합치지도 빠뜨리지도 말 것. 번호 구분이 애매하면 발문 단위로 ${body.expectCount}등분하라.`
    : body.split
      ? '\n- [문제 세트] 이 영역의 문항을 **가능한 한 잘게 나눠라**: 번호가 다른 문항(예 5번·6번)은 반드시 각각 별도 problems 항목으로 — 절대 한 문제로 묶지 마라. (단, 위 어법/어휘 선택형처럼 한 문항 내부의 네모/밑줄 다중 선택은 그 한 문제로 유지.)'
      : ''
}${
  merged
    ? '\n- [한 문제 이어붙이기] 주어진 이미지 여러 장은 **한 문제가 페이지/단으로 나뉜 것**이다. 순서대로 이어붙여 problems에 **1개만** 만들어라(절대 나누지 마라).'
    : ''
}
- category와 topic은 [분류 목록]에서 정확히 골라라.${taxonomyText}
- 글자는 보이는 그대로, 요약·번역 금지.
${MARKUP_RULES}`,
      content: [
        ...imgs.map((data) => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: body.mediaType, data },
        })),
        {
          type: 'text' as const,
          text: merged
            ? '위 이미지들은 한 문제의 이어지는 부분이다. 이어붙여 한 문제로 추출하라.'
            : '이 영역의 지문과 문제 전부를 구조화 추출하라.',
        },
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
