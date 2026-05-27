import 'server-only';
import { Type, type FunctionDeclaration } from '@google/genai';
import { GEMINI_GENERATION_MODEL, getGemini } from '@/shared/config/gemini';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { SYSTEM_PROMPT } from './prompts';
import type { AgentContext, AgentReply, Citation, ToolResult } from './types';
import { searchSourceTool } from './tools/searchSource';
import { generateProblemTool } from './tools/generateProblem';
import { evaluateAnswerTool } from './tools/evaluateAnswer';
import { assessLevelTool } from './tools/assessLevel';

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_source',
    description:
      '업로드된 PDF 자료에서 키워드로 의미 검색. 사용자가 단순 자료 조회 또는 RAG 컨텍스트가 필요할 때.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: '검색어' },
        k: { type: Type.INTEGER, description: '반환할 청크 수 (기본 8)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_problem',
    description:
      '국사 문제(객관식/단답/서술)를 만든다. 단원·난이도·개수·유형을 인자로 받는다. 결과는 출처(citation) 포함.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: '단원/주제 (예: 임진왜란)' },
        difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
        count: { type: Type.INTEGER, description: '문제 개수 (1~10, 기본 3)' },
        type: {
          type: Type.STRING,
          enum: ['objective', 'short', 'long'],
          description: '문제 유형 (기본 objective)',
        },
        gradeHint: { type: Type.STRING, description: '학년 힌트 (예: 고1)' },
      },
    },
  },
  {
    name: 'evaluate_answer',
    description:
      '한 문제에 대한 학생 답안을 평가한다. problemId와 studentAnswer 필수, studentId(이름/이메일) 필수.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        problemId: { type: Type.STRING, description: '문제 UUID' },
        studentAnswer: { type: Type.STRING, description: '학생이 작성한 답' },
        studentId: { type: Type.STRING, description: '학생 식별자 (이름 또는 이메일)' },
      },
      required: ['problemId', 'studentAnswer'],
    },
  },
  {
    name: 'assess_level',
    description:
      '학생의 누적 답안을 바탕으로 단원별·전체 실력 점수(0~100)를 계산한다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        studentId: { type: Type.STRING, description: '학생 식별자' },
        scope: { type: Type.STRING, enum: ['subject', 'topic'] },
        topic: { type: Type.STRING },
      },
    },
  },
];

async function runTool(
  name: string,
  args: unknown,
  ctx: AgentContext,
): Promise<ToolResult> {
  switch (name) {
    case 'search_source':
      return searchSourceTool(args, ctx);
    case 'generate_problem':
      return generateProblemTool(args, ctx);
    case 'evaluate_answer':
      return evaluateAnswerTool(args, ctx);
    case 'assess_level':
      return assessLevelTool(args, ctx);
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function collectCitations(results: ToolResult[]): Citation[] {
  const out: Citation[] = [];
  for (const r of results) {
    if (r.kind === 'generate_problem') {
      for (const p of r.problems) out.push(...p.citations);
    }
    if (r.kind === 'search') {
      for (const c of r.chunks) {
        out.push({
          sourceId: c.source_id,
          page: c.page_number,
          snippet: c.content.slice(0, 160),
          chapterPath: c.chapter_path,
        });
      }
    }
  }
  // dedupe by sourceId+page+snippet
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.sourceId}|${c.page}|${c.snippet}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function runAgent({
  conversationId,
  message,
  pinnedSourceIds,
  studentId,
}: {
  conversationId: string;
  message: string;
  pinnedSourceIds: string[];
  studentId: string | null;
}): Promise<AgentReply> {
  const ctx: AgentContext = { conversationId, pinnedSourceIds, studentId };
  const client = getGemini();

  const contextHints: string[] = [];
  if (studentId) contextHints.push(`학생 ID: ${studentId}`);
  if (pinnedSourceIds.length > 0)
    contextHints.push(`핀된 소스 ${pinnedSourceIds.length}개에서만 검색`);
  const augmentedMessage = contextHints.length
    ? `${message}\n\n(맥락: ${contextHints.join(', ')} — 도구 호출 시 이 값을 그대로 사용하세요.)`
    : message;

  const first = await client.models.generateContent({
    model: GEMINI_GENERATION_MODEL,
    contents: [{ role: 'user', parts: [{ text: augmentedMessage }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDeclarations }],
      temperature: 0.3,
    },
  });

  const calls =
    first.candidates?.[0]?.content?.parts?.filter((p) => 'functionCall' in p) ?? [];

  const toolResults: ToolResult[] = [];
  for (const part of calls) {
    const fc = (part as { functionCall?: { name?: string; args?: unknown } })
      .functionCall;
    if (!fc?.name) continue;
    try {
      const result = await runTool(fc.name, fc.args ?? {}, ctx);
      toolResults.push(result);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      toolResults.push({
        kind: 'search',
        chunks: [],
      });
      // we surface the error in the assistant's final text
      console.error(`[agent] tool ${fc.name} failed:`, text);
    }
  }

  let finalText = first.text ?? '';
  if (toolResults.length > 0) {
    // Second pass: feed tool results back to the model for a natural language wrap-up.
    const wrap = await client.models.generateContent({
      model: GEMINI_GENERATION_MODEL,
      contents: [
        { role: 'user', parts: [{ text: augmentedMessage }] },
        {
          role: 'user',
          parts: [
            {
              text: `도구 실행 결과(JSON):\n${JSON.stringify(toolResults).slice(0, 8000)}\n\n위 결과를 사용자에게 한국어 2~5문장으로 친근하게 정리해줘. 출처는 본문 안에 자연스럽게 언급(예: "교과서 42쪽")해도 좋다.`,
            },
          ],
        },
      ],
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.4 },
    });
    finalText = wrap.text ?? finalText;
  }

  const citations = collectCitations(toolResults);

  // resolve source titles for citations (UI uses sourceTitle)
  if (citations.length > 0) {
    const supabase = getSupabaseServer();
    const ids = Array.from(new Set(citations.map((c) => c.sourceId)));
    const { data } = await supabase
      .from('sources')
      .select('id, title')
      .in('id', ids);
    const map = new Map((data ?? []).map((r) => [r.id, r.title as string]));
    for (const c of citations) {
      if (!c.sourceTitle) c.sourceTitle = map.get(c.sourceId);
    }
  }

  return {
    text: finalText || '결과를 정리하지 못했어요.',
    toolResults,
    citations,
  };
}
