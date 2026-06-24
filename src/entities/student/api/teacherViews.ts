import 'server-only';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import type { ProblemChoice, ProblemCitation } from '@/entities/problem';

/** 선생님(uploader) 화면용 — 학생 목록 + 학습 집계, 학생 상세(정오답·약점·방). */

export type AccountRow = {
  id: string;
  email: string;
  /** 학생=이름, 선생님=별명. */
  label: string;
  grade?: string | null;
  school?: string | null;
  created_at: string;
  /** 같은 이메일이 선생님·학생 양쪽에 등록돼 있으면 true. */
  bothRoles: boolean;
};

export type AccountsData = {
  teachers: AccountRow[];
  students: AccountRow[];
  /** 선생님·학생 양쪽에 걸친 이메일 수. */
  overlapCount: number;
};

/** 등록된 계정 이메일 목록 — 선생님(admin_users) + 학생(students), 겹침 표시. */
export async function listAccounts(): Promise<AccountsData> {
  const supabase = getSupabaseServer();
  const [teacherRes, studentRes] = await Promise.all([
    supabase
      .from('admin_users')
      .select('id, email, nickname, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('students')
      .select('id, email, name, grade, school, created_at')
      .order('created_at', { ascending: false }),
  ]);
  const norm = (e: unknown) => String(e ?? '').toLowerCase();
  const teacherEmails = new Set((teacherRes.data ?? []).map((r) => norm(r.email)));
  const studentEmails = new Set((studentRes.data ?? []).map((r) => norm(r.email)));
  const teachers: AccountRow[] = (teacherRes.data ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    label: (r.nickname as string | null) ?? '',
    created_at: r.created_at as string,
    bothRoles: studentEmails.has(norm(r.email)),
  }));
  const students: AccountRow[] = (studentRes.data ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    label: r.name as string,
    grade: (r.grade as string | null) ?? null,
    school: (r.school as string | null) ?? null,
    created_at: r.created_at as string,
    bothRoles: teacherEmails.has(norm(r.email)),
  }));
  const overlapCount = [...teacherEmails].filter((e) => studentEmails.has(e)).length;
  return { teachers, students, overlapCount };
}

export type StudentStat = {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  school: string | null;
  created_at: string;
  attempts: number;
  correct: number;
  /** 0..1, attempt이 없으면 null. */
  accuracy: number | null;
  /** 마지막 문제 풀이 시각(없으면 null). */
  lastActivity: string | null;
  rooms: number;
};

export async function listStudentsWithStats(): Promise<StudentStat[]> {
  const supabase = getSupabaseServer();
  const [studentsRes, attemptsRes, convRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, email, grade, school, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('student_attempts').select('student_id, is_correct, created_at'),
    supabase.from('agent_conversations').select('student_id').not('student_id', 'is', null),
  ]);

  const attemptsBy = new Map<string, { n: number; correct: number; last: string | null }>();
  for (const a of attemptsRes.data ?? []) {
    const key = String(a.student_id);
    const cur = attemptsBy.get(key) ?? { n: 0, correct: 0, last: null };
    cur.n += 1;
    if (a.is_correct) cur.correct += 1;
    const ts = a.created_at as string;
    if (!cur.last || ts > cur.last) cur.last = ts;
    attemptsBy.set(key, cur);
  }
  const roomsBy = new Map<string, number>();
  for (const c of convRes.data ?? []) {
    const key = String(c.student_id);
    roomsBy.set(key, (roomsBy.get(key) ?? 0) + 1);
  }

  return (studentsRes.data ?? []).map((s) => {
    const a = attemptsBy.get(s.id) ?? { n: 0, correct: 0, last: null };
    return {
      id: s.id as string,
      name: s.name as string,
      email: s.email as string,
      grade: (s.grade as string | null) ?? null,
      school: (s.school as string | null) ?? null,
      created_at: s.created_at as string,
      attempts: a.n,
      correct: a.correct,
      accuracy: a.n ? a.correct / a.n : null,
      lastActivity: a.last,
      rooms: roomsBy.get(s.id) ?? 0,
    };
  });
}

export type StudentAttemptRow = {
  id: string;
  student_answer: string | null;
  is_correct: boolean | null;
  score: number | null;
  feedback: string | null;
  created_at: string;
  conversation_id: string | null;
  problem: {
    id: string;
    question: string;
    topic: string | null;
    difficulty: string | null;
    subject: string;
    choices: ProblemChoice[] | null;
    answer: string;
    explanation: string | null;
    passage: string | null;
    citations: ProblemCitation[];
  } | null;
};

export type StudentLevelRow = {
  subject: string;
  topic: string | null;
  score: number;
  samples: number;
};

export type StudentRoomRow = {
  id: string;
  title: string | null;
  summary: string | null;
  created_at: string;
  messages: number;
};

export type StudentRecord = {
  student: {
    id: string;
    name: string;
    email: string;
    grade: string | null;
    school: string | null;
    created_at: string;
  } | null;
  attempts: StudentAttemptRow[];
  levels: StudentLevelRow[];
  /** agent_memories의 weakness 메모(약점). */
  weaknesses: { content: string; created_at: string }[];
  rooms: StudentRoomRow[];
};

export async function getStudentRecord(id: string): Promise<StudentRecord> {
  const supabase = getSupabaseServer();
  const [studentRes, attemptsRes, levelsRes, memRes, roomsRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, name, email, grade, school, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('student_attempts')
      .select('id, problem_id, student_answer, is_correct, score, feedback, created_at, conversation_id')
      .eq('student_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('student_levels')
      .select('subject, topic, score, samples')
      .eq('student_id', id)
      .order('score', { ascending: true }),
    supabase
      .from('agent_memories')
      .select('content, created_at')
      .eq('student_id', id)
      .eq('kind', 'weakness')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('agent_conversations')
      .select('id, title, summary, created_at')
      .eq('student_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  // 문제 정보는 수동 조인(임베드 타입 모호성 회피).
  const attemptRows = attemptsRes.data ?? [];
  const problemIds = Array.from(
    new Set(attemptRows.map((a) => a.problem_id as string).filter(Boolean)),
  );
  const problemsBy = new Map<string, StudentAttemptRow['problem']>();
  if (problemIds.length) {
    const { data: probs } = await supabase
      .from('problems')
      .select('id, question, topic, difficulty, subject, choices, answer, passage, explanation, citations')
      .in('id', problemIds);
    for (const p of probs ?? []) {
      problemsBy.set(p.id as string, {
        id: p.id as string,
        question: p.question as string,
        topic: (p.topic as string | null) ?? null,
        difficulty: (p.difficulty as string | null) ?? null,
        subject: p.subject as string,
        choices: (p.choices as ProblemChoice[] | null) ?? null,
        answer: (p.answer as string | null) ?? '',
        explanation: (p.explanation as string | null) ?? null,
        passage: (p.passage as string | null) ?? null,
        citations: (p.citations as ProblemCitation[] | null) ?? [],
      });
    }
  }

  // 방별 메시지 수.
  const roomRows = roomsRes.data ?? [];
  const msgCounts = new Map<string, number>();
  const roomIds = roomRows.map((r) => r.id as string);
  if (roomIds.length) {
    const { data: msgs } = await supabase
      .from('agent_messages')
      .select('conversation_id')
      .in('conversation_id', roomIds);
    for (const m of msgs ?? []) {
      const key = m.conversation_id as string;
      msgCounts.set(key, (msgCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    student: studentRes.data
      ? {
          id: studentRes.data.id as string,
          name: studentRes.data.name as string,
          email: studentRes.data.email as string,
          grade: (studentRes.data.grade as string | null) ?? null,
          school: (studentRes.data.school as string | null) ?? null,
          created_at: studentRes.data.created_at as string,
        }
      : null,
    attempts: attemptRows.map((a) => ({
      id: a.id as string,
      student_answer: (a.student_answer as string | null) ?? null,
      is_correct: (a.is_correct as boolean | null) ?? null,
      score: (a.score as number | null) ?? null,
      feedback: (a.feedback as string | null) ?? null,
      created_at: a.created_at as string,
      conversation_id: (a.conversation_id as string | null) ?? null,
      problem: problemsBy.get(a.problem_id as string) ?? null,
    })),
    levels: (levelsRes.data ?? []).map((l) => ({
      subject: l.subject as string,
      topic: (l.topic as string | null) ?? null,
      score: l.score as number,
      samples: l.samples as number,
    })),
    weaknesses: (memRes.data ?? []).map((m) => ({
      content: m.content as string,
      created_at: m.created_at as string,
    })),
    rooms: roomRows.map((r) => ({
      id: r.id as string,
      title: (r.title as string | null) ?? null,
      summary: (r.summary as string | null) ?? null,
      created_at: r.created_at as string,
      messages: msgCounts.get(r.id as string) ?? 0,
    })),
  };
}
