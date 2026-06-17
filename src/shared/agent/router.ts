import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, getAnthropic } from '@/shared/config/anthropic';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { AgentContext, AgentReply, Citation, ToolResult } from './types';
import type { AgentId, AgentProfile, Audience } from './agents/types';
import { classifyAgent } from './agents/classify';
import { buildStudentStyleOverlay } from './agents/studentStyle';
import { buildGrokPersona } from './agents/grokPersona';
import { streamGrokText } from '@/shared/config/xai';
import { formatLearningMemories, formatMemories, loadMemories } from './memory';
import {
  buildToolDeclarations,
  getProfile,
  resolveAllowedTools,
} from './agents/registry';
import { searchSourceTool } from './tools/searchSource';
import { searchProblemTool, toProblemDrafts } from './tools/searchProblem';
import { searchProblems } from '@/entities/problem/server';
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
  if (ctx.schoolName) hints.push(`학교: ${ctx.schoolName} 자료 기반`);
  if (ctx.studentId) hints.push(`학생 ID: ${ctx.studentId}`);
  if (ctx.pinnedSourceIds.length > 0)
    hints.push(`핀된 소스 ${ctx.pinnedSourceIds.length}개에서만 검색`);
  return `${message}\n\n(맥락: ${hints.join(', ')} — 도구 호출 시 이 값을 그대로 사용하세요.)`;
}

/**
 * Profile system prompt, plus the remembered-facts block for memory-enabled
 * profiles (companion/emotion).
 */
async function buildAgentSystem(
  profile: AgentProfile,
  subject: string,
  audience: Audience,
  studentId: string | null,
  schoolName?: string | null,
  studentGrade?: string | null,
): Promise<string> {
  let system = profile.systemPrompt(subject, audience);
  if (schoolName) {
    system += `\n\n[학교 컨텍스트] 이 대화는 '${schoolName}'의 시험대비 자료를 기반으로 합니다. 답변할 때 search_source로 찾은 이 학교 자료와 저장된 문제를 최우선 근거로 사용하고, 자료에 없는 내용은 일반 지식임을 밝히세요.`;
  }
  if (profile.useMemories) {
    // companion/emotion: 교감용 기억 전부 주입
    const memories = await loadMemories(studentId);
    system += formatMemories(memories);
  } else if (studentId) {
    // 튜터링 에이전트 + 식별된 학생: 강약점·진도 프로필 주입 → 약한 유형 우선 출제
    const memories = await loadMemories(studentId);
    system += formatLearningMemories(memories);
  }
  if (audience === 'student') {
    system += buildStudentStyleOverlay(studentGrade ?? null);
  }
  if (profile.provider === 'grok') {
    system += buildGrokPersona();
  }
  return system;
}

/**
 * RAG 스코프 resolve: scopeId가 있으면 시험범위에 담긴 소스로, 없으면 기존
 * 학교(school_id) 자료로 retrieval을 한정한다. schoolName은 시스템 프롬프트
 * 컨텍스트 표기에 쓰인다(범위면 "{학교} {범위}").
 */
async function resolveScope(args: {
  scopeId?: string | null;
  schoolId?: string | null;
}): Promise<{ schoolName: string | null; sourceIds: string[]; problemIds: string[] | null }> {
  const supabase = getSupabaseServer();
  if (args.scopeId) {
    const { data: scope } = await supabase
      .from('exam_scopes')
      .select('id, name, school_id')
      .eq('id', args.scopeId)
      .maybeSingle();
    if (!scope) return { schoolName: null, sourceIds: [], problemIds: null };
    const [{ data: school }, { data: rows }, { data: probRows }] = await Promise.all([
      supabase.from('schools').select('name').eq('id', scope.school_id).maybeSingle(),
      supabase.from('exam_scope_sources').select('source_id').eq('scope_id', args.scopeId),
      supabase.from('exam_scope_problems').select('problem_id').eq('scope_id', args.scopeId),
    ]);
    const label = [school?.name, scope.name].filter(Boolean).join(' ');
    // 문제 화이트리스트가 있으면 그 문제로만 한정. 없으면(레거시 범위) 문제 미한정(null).
    const problemIds =
      probRows && probRows.length ? probRows.map((r) => r.problem_id as string) : null;
    return {
      schoolName: label || (scope.name as string),
      sourceIds: (rows ?? []).map((r) => r.source_id as string),
      problemIds,
    };
  }
  const schoolId = args.schoolId;
  if (!schoolId) return { schoolName: null, sourceIds: [], problemIds: null };
  const { data: school } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', schoolId)
    .maybeSingle();
  if (!school) return { schoolName: null, sourceIds: [], problemIds: null };
  const { data: srcs } = await supabase
    .from('sources')
    .select('id')
    .eq('school_id', schoolId)
    .eq('indexing_status', 'ready');
  return {
    schoolName: school.name as string,
    sourceIds: (srcs ?? []).map((r) => r.id as string),
    problemIds: null,
  };
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
  /** 학교별 RAG: scope retrieval to this school's indexed sources. */
  schoolId?: string | null;
  /** 시험범위 RAG: scope retrieval to this exam scope's sources (우선). */
  scopeId?: string | null;
  /** Prior turns of this conversation (tutoring loop needs them). */
  history?: Anthropic.MessageParam[];
  /** Specialist that produced the last assistant turn (sticky routing). */
  lastAgent?: AgentId | null;
  /** 학생 학년 — 학생 모드 말투 오버레이에 주입. */
  studentGrade?: string | null;
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
  /** Resolved school name when schoolId was given (for the wrap-up call). */
  schoolName: string | null;
}> {
  const audience: Audience = args.audience ?? 'teacher';
  const client = getAnthropic();

  // Supervisor: pick the specialist, then expose only its (audience-gated) tools.
  const { agent } = await classifyAgent(args.message, {
    subject: args.subject,
    audience,
    lastAgent: args.lastAgent ?? null,
  });
  const profile = getProfile(agent);
  const allowed = resolveAllowedTools(profile, audience);

  const school = await resolveScope({ scopeId: args.scopeId, schoolId: args.schoolId });
  const pinnedSourceIds =
    school.sourceIds.length > 0
      ? Array.from(new Set([...args.pinnedSourceIds, ...school.sourceIds]))
      : args.pinnedSourceIds;

  const ctx: AgentContext = {
    conversationId: args.conversationId,
    pinnedSourceIds,
    studentId: args.studentId,
    subject: args.subject,
    audience,
    problemPeek: profile.problemPeek,
    schoolName: school.schoolName,
    problemIds: school.problemIds,
  };
  const augmentedMessage = buildAugmentedMessage(args.message, ctx);
  const system = await buildAgentSystem(
    profile,
    args.subject,
    audience,
    args.studentId,
    school.schoolName,
    args.studentGrade,
  );

  // 교감(grok) 에이전트는 툴이 없으므로 Claude 호출 자체를 건너뛰고
  // streamWrapup에서 곧장 Grok으로 스트리밍한다.
  let directText = '';
  const toolResults: ToolResult[] = [];
  if (profile.provider !== 'grok') {
    const first = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system,
      ...(allowed.length ? { tools: buildToolDeclarations(allowed) } : {}),
      messages: [...(args.history ?? []), { role: 'user', content: augmentedMessage }],
    });

    const calls = first.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    // Keep any direct text the model produced when it didn't call a tool, so an
    // off-topic / no-tool question still gets a real answer instead of a blank.
    directText = first.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    for (const call of calls) {
      try {
        const result = await runTool(call.name, call.input ?? {}, ctx);
        toolResults.push(result);
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        console.error(`[agent] tool ${call.name} failed:`, text);
      }
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
        problemIds: ctx.problemIds,
      });
      const strong = matches.filter((m) => m.similarity >= AUTO_PROBLEM_THRESHOLD);
      if (strong.length > 0) {
        // 한 턴에 문제 1개만 — 가장 강한 매치 하나만 노출.
        toolResults.push({ kind: 'search_problem', problems: toProblemDrafts(strong.slice(0, 1)) });
      }
    } catch (e) {
      console.error('[agent] auto search_problem failed:', e);
    }
  }

  const citations = collectCitations(toolResults);
  await resolveSourceTitles(citations);

  return {
    ctx,
    augmentedMessage,
    toolResults,
    citations,
    directText,
    profile,
    agent,
    schoolName: school.schoolName,
  };
}

/** Yield text deltas from a Claude streaming call. */
async function* streamClaudeText(
  client: Anthropic,
  params: { system: string; messages: Anthropic.MessageParam[] },
): AsyncGenerator<string, void, void> {
  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    system: params.system,
    messages: params.messages,
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      if (event.delta.text) yield event.delta.text;
    }
  }
}

/** Stream the natural-language wrap-up after tools ran, in the profile's voice. */
export async function* streamWrapup(args: {
  augmentedMessage: string;
  toolResults: ToolResult[];
  initialText: string;
  subject?: string;
  profile: AgentProfile;
  audience?: Audience;
  studentId?: string | null;
  schoolName?: string | null;
  history?: Anthropic.MessageParam[];
  /** 학생 학년 — 학생 모드 말투 오버레이에 주입. */
  studentGrade?: string | null;
}): AsyncGenerator<string, void, void> {
  const audience: Audience = args.audience ?? 'teacher';
  const subject = args.subject ?? '학습';
  const client = getAnthropic();
  const system = await buildAgentSystem(
    args.profile,
    subject,
    audience,
    args.studentId ?? null,
    args.schoolName ?? null,
    args.studentGrade,
  );

  // 교감(grok) 에이전트 — 툴 없음. 곧장 Grok으로 스트리밍.
  if (args.profile.provider === 'grok') {
    yield* streamGrokText({
      system,
      messages: [...(args.history ?? []), { role: 'user', content: args.augmentedMessage }],
    });
    return;
  }

  if (args.toolResults.length === 0) {
    // Model already produced a direct answer in the profile's voice — use it.
    if (args.initialText) {
      yield args.initialText;
      return;
    }
    // Non-always-answer profiles stay silent rather than fabricate.
    if (!args.profile.alwaysAnswer) return;
    // Socratic (and grammar/vocab/companion/emotion): synthesize a turn from
    // the question alone.
    yield* streamClaudeText(client, {
      system,
      messages: [
        ...(args.history ?? []),
        { role: 'user', content: args.augmentedMessage },
      ],
    });
    return;
  }

  yield* streamClaudeText(client, {
    system,
    messages: [
      ...(args.history ?? []),
      { role: 'user', content: args.augmentedMessage },
      {
        role: 'user',
        content: `도구 실행 결과(JSON):\n${JSON.stringify(args.toolResults).slice(0, 8000)}\n\n${args.profile.wrapupInstruction(audience)}`,
      },
    ],
  });
}

/** Convenience: collect everything into a single AgentReply (non-streaming path). */
export async function runAgent(args: {
  conversationId: string;
  message: string;
  pinnedSourceIds: string[];
  studentId: string | null;
  subject: string;
  audience?: Audience;
  schoolId?: string | null;
  history?: Anthropic.MessageParam[];
  lastAgent?: AgentId | null;
  studentGrade?: string | null;
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
    studentId: args.studentId,
    history: args.history,
    studentGrade: args.studentGrade,
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
