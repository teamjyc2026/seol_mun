import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/shared/config/anthropic';
import type { PdfPage } from './pdf';

/** Claude PDF input limits: 100 pages / 32MB. We stay well under for safety. */
export const OCR_MAX_PAGES = 40;
export const OCR_MAX_BYTES = 30 * 1024 * 1024;

const OCR_SYSTEM = `당신은 시험지·교재 스캔본 PDF의 OCR 전사기입니다. 각 페이지의 모든 텍스트를 보이는 그대로, 빠짐없이 전사하세요.
- 문제 번호, 보기(①②③④⑤), 지문(영어 포함), 발문, 배점, 정답·해설 등 모든 텍스트 포함.
- 줄바꿈은 자연스러운 문단 단위로 정리하되 내용은 절대 요약·생략·번역하지 마세요.
- 표는 행 단위 텍스트로, 그림·도식은 짧은 대체 설명 [그림: ...]으로 표기.
- 읽을 수 없는 글자는 ▢로 표기.`;

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          page: { type: 'integer', description: '1부터 시작하는 페이지 번호' },
          text: { type: 'string', description: '해당 페이지 전체 전사 텍스트' },
        },
        required: ['page', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['pages'],
  additionalProperties: false,
} as const;

/**
 * OCR a scanned PDF with Claude (PDF document block + structured output).
 * Streams to allow large transcriptions. Returns per-page text in the same
 * shape as `extractTextWithPages().pages`.
 */
export async function ocrPdfWithClaude(buf: Buffer): Promise<PdfPage[]> {
  if (buf.byteLength > OCR_MAX_BYTES) {
    throw new Error(
      `PDF가 OCR 한도(${Math.round(OCR_MAX_BYTES / 1024 / 1024)}MB)를 초과합니다.`,
    );
  }
  const client = getAnthropic();
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: buf.toString('base64'),
      },
    },
    {
      type: 'text',
      text: '이 PDF의 모든 페이지를 1페이지부터 순서대로 전사하라.',
    },
  ];

  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 64000,
    system: OCR_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: OCR_SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'max_tokens') {
    throw new Error('OCR 출력이 토큰 한도에서 잘렸습니다. PDF를 분할해 주세요.');
  }
  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = JSON.parse(text) as { pages: { page: number; text: string }[] };
  return (parsed.pages ?? [])
    .filter((p) => Number.isFinite(p.page))
    .sort((a, b) => a.page - b.page)
    .map((p) => ({ page: p.page, text: (p.text ?? '').trim() }));
}
