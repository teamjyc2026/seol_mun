import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { AgentId, AgentProfile, Audience, ToolName } from './types';
import { PROFILES } from './profiles';

/**
 * The five tool declarations (Anthropic Tool / JSON Schema), keyed by name so
 * a profile can expose a subset. Descriptions unchanged from the Gemini era.
 */
export const TOOL_DECLARATIONS: Record<ToolName, Anthropic.Tool> = {
  search_source: {
    name: 'search_source',
    description:
      '업로드된 PDF 자료에서 키워드로 의미 검색. 사용자가 단순 자료 조회 또는 RAG 컨텍스트가 필요할 때.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어' },
        k: { type: 'integer', description: '반환할 청크 수 (기본 8)' },
      },
      required: ['query'],
    },
  },
  search_problem: {
    name: 'search_problem',
    description:
      '저장·임베딩된 기존 문제를 과목·유사도로 검색한다. 사용자가 어떤 질문/문장을 입력하면 그게 저장된 문제일 수 있으니 적극적으로 이 도구를 먼저 호출해 관련 문제를 찾아라. "문제 찾아줘/보여줘/비슷한 문제"는 물론, 일반 질문처럼 보이는 입력도 우선 검색해 본다.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어 (주제·키워드·문제 내용)' },
        k: { type: 'integer', description: '반환할 문제 수 (기본 5)' },
      },
      required: ['query'],
    },
  },
  generate_problem: {
    name: 'generate_problem',
    description:
      '선택된 과목의 문제(객관식/단답/서술)를 만든다. 단원·난이도·개수·유형을 인자로 받는다. 결과는 출처(citation) 포함.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: '단원/주제 (예: 임진왜란)' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        count: { type: 'integer', description: '문제 개수 (1~10, 기본 3)' },
        type: {
          type: 'string',
          enum: ['objective', 'short', 'long'],
          description: '문제 유형 (기본 objective)',
        },
        gradeHint: { type: 'string', description: '학년 힌트 (예: 고1)' },
      },
    },
  },
  evaluate_answer: {
    name: 'evaluate_answer',
    description:
      '한 문제에 대한 학생 답안을 평가한다. problemId와 studentAnswer 필수, studentId(이름/이메일) 필수.',
    input_schema: {
      type: 'object',
      properties: {
        problemId: { type: 'string', description: '문제 UUID' },
        studentAnswer: { type: 'string', description: '학생이 작성한 답' },
        studentId: { type: 'string', description: '학생 식별자 (이름 또는 이메일)' },
      },
      required: ['problemId', 'studentAnswer'],
    },
  },
  assess_level: {
    name: 'assess_level',
    description:
      '학생의 누적 답안을 바탕으로 단원별·전체 실력 점수(0~100)를 계산한다.',
    input_schema: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '학생 식별자' },
        scope: { type: 'string', enum: ['subject', 'topic'] },
        topic: { type: 'string' },
      },
    },
  },
};

export function getProfile(id: AgentId): AgentProfile {
  return PROFILES[id] ?? PROFILES.general;
}

/**
 * Audience gating: students (and any profile that withholds answers) never get
 * answer-revealing tools, regardless of the profile's declared `allowedTools`.
 */
export function resolveAllowedTools(
  profile: AgentProfile,
  audience: Audience,
): ToolName[] {
  let tools = profile.allowedTools;
  if (audience === 'student' || !profile.allowAnswerReveal) {
    tools = tools.filter(
      (t) => t !== 'evaluate_answer' && t !== 'generate_problem',
    );
  }
  return tools;
}

export function buildToolDeclarations(names: ToolName[]): Anthropic.Tool[] {
  return names.map((n) => TOOL_DECLARATIONS[n]);
}
