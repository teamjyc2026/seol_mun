/** Specialist agent identifiers chosen by the supervisor (classifyAgent). */
export type AgentId =
  | 'socratic'
  | 'grammar'
  | 'vocab'
  | 'problem_finder'
  | 'recite'
  | 'reading'
  | 'companion'
  | 'emotion'
  | 'general';

/** Who is talking to the agent. Gates which tools/behaviors are allowed. */
export type Audience = 'teacher' | 'student';

/** The five tools the orchestrator can expose to the model. */
export type ToolName =
  | 'search_source'
  | 'search_problem'
  | 'generate_problem'
  | 'evaluate_answer'
  | 'assess_level';

/**
 * Constrains how a specialist "peeks" at saved problems via search_problem:
 * only surface matches at/above `minSimilarity`, and at most `limit` of them.
 * Keeps grammar/vocab/socratic from dumping irrelevant or too many problems.
 */
export type ProblemPeek = { minSimilarity: number; limit: number };

/**
 * A specialist profile = system prompt + the tool subset it may use +
 * how its wrap-up is phrased + behavior flags. The supervisor picks one
 * profile per turn; the orchestrator runs the turn under it.
 */
export type AgentProfile = {
  id: AgentId;
  /** Short label shown as a `[말머리]` prefix in the UI (empty = no prefix). */
  label: string;
  systemPrompt: (subject: string, audience: Audience) => string;
  /** Tool subset before audience gating (see resolveAllowedTools). */
  allowedTools: ToolName[];
  /** Instruction appended to the tool-result JSON for the wrap-up call. */
  wrapupInstruction: (audience: Audience) => string;
  /** false → strip answer-revealing tools + harden the prompt. */
  allowAnswerReveal: boolean;
  /** When set, constrains search_problem to relevant + few (specialist peek). */
  problemPeek?: ProblemPeek;
  /** Always produce a model turn even when zero tools ran (Socratic). */
  alwaysAnswer: boolean;
  /** Whether the 0.78 auto-surfaced-problem fallback may fire. */
  autoProblemFallback: boolean;
  /**
   * Inject per-user memories (agent_memories) into the system prompt and
   * extract new ones after the turn (companion/emotion).
   */
  useMemories?: boolean;
};
