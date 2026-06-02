import 'server-only';
import { GEMINI_GENERATION_MODEL, getGemini } from '@/shared/config/gemini';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { AgentContext, AgentReply, Citation, ToolResult } from './types';
import type { AgentId, AgentProfile, Audience } from './agents/types';
import { classifyAgent } from './agents/classify';
import {
  buildToolDeclarations,
  getProfile,
  resolveAllowedTools,
} from './agents/registry';
import { searchSourceTool } from './tools/searchSource';
import { searchProblemTool, toProblemDrafts } from './tools/searchProblem';
import { searchProblems } from '@/entities/problem/api/searchProblems';
import { generateProblemTool } from './tools/generateProblem';
import { evaluateAnswerTool } from './tools/evaluateAnswer';
import { assessLevelTool } from './tools/assessLevel';

/** Min cosine similarity for an auto-surfaced saved problem (no explicit ask). */
const AUTO_PROBLEM_THRESHOLD = 0.78;

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
  audience?: Audience;
}): Promise<{
  ctx: AgentContext;
  augmentedMessage: string;
  toolResults: ToolResult[];
  citations: Citation[];
  /** Direct text answer from the model when it chose not to call any tool. */
  directText: string;
  /** The specialist profile chosen for this turn. */
  profile: AgentProfile;
  /** The chosen specialist id (surfaced to the client). */
  agent: AgentId;
}> {
  const audience: Audience = args.audience ?? 'teacher';
  const client = getGemini();

  // Supervisor: pick the specialist, then expose only its (audience-gated) tools.
  const { agent } = await classifyAgent(args.message, {
    subject: args.subject,
    audience,
  });
  const profile = getProfile(agent);
  const allowed = resolveAllowedTools(profile, audience);

  const ctx: AgentContext = {
    conversationId: args.conversationId,
    pinnedSourceIds: args.pinnedSourceIds,
    studentId: args.studentId,
    subject: args.subject,
    audience,
    problemPeek: profile.problemPeek,
  };
  const augmentedMessage = buildAugmentedMessage(args.message, ctx);

  const first = await client.models.generateContent({
    model: GEMINI_GENERATION_MODEL,
    contents: [{ role: 'user', parts: [{ text: augmentedMessage }] }],
    config: {
      systemInstruction: profile.systemPrompt(args.subject, audience),
      ...(allowed.length
        ? { tools: [{ functionDeclarations: buildToolDeclarations(allowed) }] }
        : {}),
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
  // don't have to explicitly say "문제에서 찾아줘". Skipped for profiles that
  // withhold answers (socratic) or aren't problem-oriented (grammar/vocab).
  if (toolResults.length === 0 && profile.autoProblemFallback) {
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

  return { ctx, augmentedMessage, toolResults, citations, directText, profile, agent };
}

/** Stream the natural-language wrap-up after tools ran, in the profile's voice. */
export async function* streamWrapup(args: {
  augmentedMessage: string;
  toolResults: ToolResult[];
  initialText: string;
  subject?: string;
  profile: AgentProfile;
  audience?: Audience;
}): AsyncGenerator<string, void, void> {
  const audience: Audience = args.audience ?? 'teacher';
  const subject = args.subject ?? '학습';
  const client = getGemini();

  if (args.toolResults.length === 0) {
    // Model already produced a direct answer in the profile's voice — use it.
    if (args.initialText) {
      yield args.initialText;
      return;
    }
    // Non-always-answer profiles stay silent rather than fabricate.
    if (!args.profile.alwaysAnswer) return;
    // Socratic (and grammar/vocab): synthesize a turn from the question alone.
    const stream = await client.models.generateContentStream({
      model: GEMINI_GENERATION_MODEL,
      contents: [{ role: 'user', parts: [{ text: args.augmentedMessage }] }],
      config: {
        systemInstruction: args.profile.systemPrompt(subject, audience),
        temperature: 0.5,
      },
    });
    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (text) yield text;
    }
    return;
  }

  const stream = await client.models.generateContentStream({
    model: GEMINI_GENERATION_MODEL,
    contents: [
      { role: 'user', parts: [{ text: args.augmentedMessage }] },
      {
        role: 'user',
        parts: [
          {
            text: `도구 실행 결과(JSON):\n${JSON.stringify(args.toolResults).slice(0, 8000)}\n\n${args.profile.wrapupInstruction(audience)}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: args.profile.systemPrompt(subject, audience),
      temperature: 0.4,
    },
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
  audience?: Audience;
}): Promise<AgentReply> {
  const { augmentedMessage, toolResults, citations, directText, profile, agent } =
    await runAgentTools(args);
  let text = '';
  for await (const chunk of streamWrapup({
    augmentedMessage,
    toolResults,
    initialText: directText,
    subject: args.subject,
    profile,
    audience: args.audience,
  })) {
    text += chunk;
  }
  return {
    text: text || '결과를 정리하지 못했어요.',
    toolResults,
    citations,
    agent,
  };
}
