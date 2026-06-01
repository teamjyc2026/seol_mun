import 'server-only';
import { Type, type FunctionDeclaration } from '@google/genai';
import { GEMINI_GENERATION_MODEL, getGemini } from '@/shared/config/gemini';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { buildSystemPrompt } from './prompts';
import type { AgentContext, AgentReply, Citation, ToolResult } from './types';
import { searchSourceTool } from './tools/searchSource';
import { searchProblemTool, toProblemDrafts } from './tools/searchProblem';
import { searchProblems } from '@/entities/problem/api/searchProblems';
import { generateProblemTool } from './tools/generateProblem';

/** Min cosine similarity for an auto-surfaced saved problem (no explicit ask). */
const AUTO_PROBLEM_THRESHOLD = 0.78;
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
    name: 'search_problem',
    description:
      '저장·임베딩된 기존 문제를 과목·유사도로 검색한다. 사용자가 어떤 질문/문장을 입력하면 그게 저장된 문제일 수 있으니 적극적으로 이 도구를 먼저 호출해 관련 문제를 찾아라. "문제 찾아줘/보여줘/비슷한 문제"는 물론, 일반 질문처럼 보이는 입력도 우선 검색해 본다.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: '검색어 (주제·키워드·문제 내용)' },
        k: { type: Type.INTEGER, description: '반환할 문제 수 (기본 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_problem',
    description:
      '선택된 과목의 문제(객관식/단답/서술)를 만든다. 단원·난이도·개수·유형을 인자로 받는다. 결과는 출처(citation) 포함.',
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
    case 'search_problem':
      return searchProblemTool(args, ctx);
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
    if (r.kind === 'generate_problem' || r.kind === 'search_problem') {
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
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.sourceId}|${c.page}|${c.snippet}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildAugmentedMessage(
  message: string,
  ctx: AgentContext,
): string {
  const hints: string[] = [];
  hints.push(`과목: ${ctx.subject}`);
  if (ctx.studentId) hints.push(`학생 ID: ${ctx.studentId}`);
  if (ctx.pinnedSourceIds.length > 0)
    hints.push(`핀된 소스 ${ctx.pinnedSourceIds.length}개에서만 검색`);
  return `${message}\n\n(맥락: ${hints.join(', ')} — 도구 호출 시 이 값을 그대로 사용하세요.)`;
}

async function resolveSourceTitles(citations: Citation[]): Promise<void> {
  if (citations.length === 0) return;
  const supabase = getSupabaseServer();
  const ids = Array.from(new Set(citations.map((c) => c.sourceId)));
  const { data } = await supabase.from('sources').select('id, title').in('id', ids);
  const map = new Map((data ?? []).map((r) => [r.id, r.title as string]));
  for (const c of citations) {
    if (!c.sourceTitle) c.sourceTitle = map.get(c.sourceId);
  }
}

/**
 * Run tools (sync). Returns the tool results, the user-augmented message,
 * and the citation list. Caller can then stream the wrap-up.
 */
export async function runAgentTools(args: {
  conversationId: string;
  message: string;
  pinnedSourceIds: string[];
  studentId: string | null;
  subject: string;
}): Promise<{
  ctx: AgentContext;
  augmentedMessage: string;
  toolResults: ToolResult[];
  citations: Citation[];
  /** Direct text answer from the model when it chose not to call any tool. */
  directText: string;
}> {
  const ctx: AgentContext = {
    conversationId: args.conversationId,
    pinnedSourceIds: args.pinnedSourceIds,
    studentId: args.studentId,
    subject: args.subject,
  };
  const client = getGemini();
  const augmentedMessage = buildAugmentedMessage(args.message, ctx);

  const first = await client.models.generateContent({
    model: GEMINI_GENERATION_MODEL,
    contents: [{ role: 'user', parts: [{ text: augmentedMessage }] }],
    config: {
      systemInstruction: buildSystemPrompt(args.subject),
      tools: [{ functionDeclarations: toolDeclarations }],
      temperature: 0.3,
    },
  });

  const parts = first.candidates?.[0]?.content?.parts ?? [];
  const calls = parts.filter((p) => 'functionCall' in p);
  // Keep any direct text the model produced when it didn't call a tool, so an
  // off-topic / no-tool question still gets a real answer instead of a blank.
  const directText = parts
    .map((p) => (p as { text?: string }).text ?? '')
    .join('')
    .trim();

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
      console.error(`[agent] tool ${fc.name} failed:`, text);
    }
  }

  // Deterministic fallback: if the model chose no tool (would just answer or
  // refuse), auto-search saved problems and surface a strong match so users
  // don't have to explicitly say "문제에서 찾아줘".
  if (toolResults.length === 0) {
    try {
      const matches = await searchProblems(args.message, {
        subject: ctx.subject,
        k: 5,
      });
      const strong = matches.filter((m) => m.similarity >= AUTO_PROBLEM_THRESHOLD);
      if (strong.length > 0) {
        toolResults.push({ kind: 'search_problem', problems: toProblemDrafts(strong) });
      }
    } catch (e) {
      console.error('[agent] auto search_problem failed:', e);
    }
  }

  const citations = collectCitations(toolResults);
  await resolveSourceTitles(citations);

  return { ctx, augmentedMessage, toolResults, citations, directText };
}

/** Stream the natural-language wrap-up after tools ran. */
export async function* streamWrapup(args: {
  augmentedMessage: string;
  toolResults: ToolResult[];
  initialText: string;
  subject?: string;
}): AsyncGenerator<string, void, void> {
  if (args.toolResults.length === 0) {
    if (args.initialText) yield args.initialText;
    return;
  }
  const client = getGemini();
  const stream = await client.models.generateContentStream({
    model: GEMINI_GENERATION_MODEL,
    contents: [
      { role: 'user', parts: [{ text: args.augmentedMessage }] },
      {
        role: 'user',
        parts: [
          {
            text: `도구 실행 결과(JSON):\n${JSON.stringify(args.toolResults).slice(0, 8000)}\n\n위 결과를 사용자에게 한국어 2~5문장으로 친근하게 정리해줘. 출처는 본문 안에 자연스럽게 언급(예: "교과서 42쪽")해도 좋다.`,
          },
        ],
      },
    ],
    config: { systemInstruction: buildSystemPrompt(args.subject), temperature: 0.4 },
  });
  for await (const chunk of stream) {
    const text = chunk.text ?? '';
    if (text) yield text;
  }
}

/** Convenience: collect everything into a single AgentReply (non-streaming path). */
export async function runAgent(args: {
  conversationId: string;
  message: string;
  pinnedSourceIds: string[];
  studentId: string | null;
  subject: string;
}): Promise<AgentReply> {
  const { augmentedMessage, toolResults, citations, directText } =
    await runAgentTools(args);
  let text = '';
  for await (const chunk of streamWrapup({
    augmentedMessage,
    toolResults,
    initialText: directText,
    subject: args.subject,
  })) {
    text += chunk;
  }
  return {
    text: text || '결과를 정리하지 못했어요.',
    toolResults,
    citations,
  };
}
