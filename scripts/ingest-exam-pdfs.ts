/**
 * 시험대비 PDF 일괄 인제스트 (스캔본 OCR + 메타데이터 추론 + 문제/정답 판독).
 *
 * 실행:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ingest-exam-pdfs.ts \
 *     ~/Downloads/drive-download-A ~/Downloads/drive-download-B [--only day7_8] [--school 서울예고]
 *
 * 각 PDF에 대해:
 *  1) Claude로 메타데이터(제목/과목/학년/유형/단원/태그) 추론
 *  2) Supabase Storage 업로드 + sources 등록 + 인덱싱(스캔본이면 Claude OCR)
 *  3) 문제지(문제/평가문제/학습지)는 문제 구조화 추출 — 정답 PDF가 짝으로 있으면
 *     함께 판독, 없으면 Claude가 풀어서 정답 추정(notes에 '검수 필요' 표기)
 *  4) problems 등록 + Gemini 임베딩까지 완료
 */
import './load-env';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { claudeJson } from '@/shared/config/anthropic';
import { getSupabaseServer } from '@/shared/config/supabase-server';
import { SUBJECTS } from '@/shared/config/subjects';
import { indexSource } from '@/shared/agent/indexSource';
import { embedTexts } from '@/shared/lib/embedding';

const SCHOOL_DEFAULT = '서울예고';

type Choice = { label: string; text: string };
type ExtractedProblem = {
  page: number;
  passageKey?: string;
  passage?: string;
  question: string;
  choices?: Choice[];
  answer: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
};

type SourceMeta = {
  title: string;
  subject: string;
  subjects: string[];
  grade: string;
  source_type: string;
  publisher?: string;
  units: string[];
  tags: string[];
  description: string;
};

function pdfBlock(buf: Buffer): Anthropic.ContentBlockParam {
  return {
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: buf.toString('base64'),
    },
  };
}

/**
 * macOS stores Korean filenames in NFD (decomposed jamo) — NFC-normalize
 * before any regex/string comparison or the 문제/정답 patterns never match.
 */
function nfc(s: string): string {
  return s.normalize('NFC');
}

/** "20260605_EBS_day7_8_문제.pdf" → "20260605_ebs_day7_8" */
function pairStem(filename: string): string {
  return nfc(path.basename(filename, path.extname(filename)))
    .toLowerCase()
    .replace(/[_\s]*(문제|정답|해설)\s*$/u, '');
}

function isAnswerPdf(filename: string): boolean {
  return /정답|해설/.test(nfc(filename));
}

function isProblemPdf(filename: string): boolean {
  const n = nfc(filename);
  return /문제|학습지|평가/.test(n) && !isAnswerPdf(n);
}

async function inferMetadata(buf: Buffer, filename: string): Promise<SourceMeta> {
  return claudeJson<SourceMeta>({
    system: `너는 한국 고등학교(서울예술고등학교) 시험대비 자료의 사서다. 주어진 PDF를 보고 메타데이터를 추론하라.
- title: 자료를 식별하기 좋은 한국어 제목 (예: "EBS 수능특강 영어 Day 7-8 문제"). 파일명도 참고: ${filename}
- subject: 다음 중 하나만: ${SUBJECTS.join(', ')}
- grade: 중1|중2|중3|고1|고2|고3 중 내용 수준에 맞는 것 (서울예고 시험대비 자료임)
- source_type: 교과서|문제집|기출|요약본|강의자료|기타 중 하나 (문제지/평가문제→문제집, 학교 시험지→기출)
- units: 다루는 단원·주제 키워드 배열 (예: ["관계대명사", "Day 7"])
- tags: 검색용 태그 배열 (예: ["서울예고", "시험대비", "EBS"]) — "서울예고", "시험대비"는 항상 포함
- description: 1~2문장 요약`,
    content: [
      pdfBlock(buf),
      { type: 'text', text: '이 PDF의 메타데이터를 추론하라.' },
    ],
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subject: { type: 'string', enum: [...SUBJECTS] },
        subjects: { type: 'array', items: { type: 'string' } },
        grade: { type: 'string', enum: ['중1', '중2', '중3', '고1', '고2', '고3'] },
        source_type: {
          type: 'string',
          enum: ['교과서', '문제집', '기출', '요약본', '강의자료', '기타'],
        },
        publisher: { type: 'string' },
        units: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
      },
      required: ['title', 'subject', 'subjects', 'grade', 'source_type', 'units', 'tags', 'description'],
      additionalProperties: false,
    },
    maxTokens: 4096,
  });
}

async function extractProblems(
  problemBuf: Buffer,
  answerBuf: Buffer | null,
): Promise<ExtractedProblem[]> {
  const content: Anthropic.ContentBlockParam[] = [pdfBlock(problemBuf)];
  if (answerBuf) content.push(pdfBlock(answerBuf));
  content.push({
    type: 'text',
    text: answerBuf
      ? '첫 번째 PDF는 문제지, 두 번째 PDF는 정답/해설지다. 문제지의 모든 문제를 추출하고, 정답·해설은 반드시 정답지에서 찾아 채워라.'
      : '이 문제지의 모든 문제를 추출하라. 정답지가 없으므로 각 문제를 네가 직접 정확히 풀어 answer와 explanation을 작성하라. 확신이 없는 문제도 가장 타당한 답을 고르되 explanation에 근거를 충실히 적어라.',
  });

  const { problems } = await claudeJson<{ problems: ExtractedProblem[] }>({
    system: `너는 한국 고등학교 시험지 디지털화 전문가다. 스캔본 문제지에서 모든 문제를 빠짐없이 구조화 추출한다.
- question: 발문 전체(번호 제외). 영어 지문 문제면 발문만 넣고 지문은 passage에.
- passage: [필수 규칙] 발문이 "윗글", "다음 글", "밑줄 친", "빈칸" 등 지문을 참조하면 passage를 반드시 채워라 — passage 없이 발문만 추출하면 그 문제는 풀 수 없는 쓰레기 데이터가 된다.
  · 지문 안의 밑줄 친 어구는 라벨과 함께 굵게 유지: "ⓐ **diagnosing**" / "(A) **which**"
  · 네모 안 선택 어구는 "[which / that]" 형태로 유지. 빈칸은 "______"로 유지.
  · 여러 문제가 같은 지문을 공유하면 동일한 passageKey(예: "p1")를 부여하고 각 문제에 passage 전체를 그대로 반복해 넣어라.
- choices: 객관식이면 보기 전부 (label: "①"~"⑤"), 주관식이면 생략. 보기가 ⓐ~ⓔ 참조뿐이면 text에 해당 어구도 같이: "ⓐ (diagnosing)".
- answer: 정답 (객관식은 "①" 형식, 주관식은 정답 텍스트).
- explanation: 해설 (정답지에 있으면 그대로, 없으면 직접 작성).
- page: 해당 문제가 있는 문제지 페이지 번호(1부터).
- difficulty: easy|medium|hard 추정. topic: 단원/주제(예: "관계대명사").
- 단 하나의 문제도 빠뜨리지 마라.`,
    content,
    schema: {
      type: 'object',
      properties: {
        problems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              passageKey: { type: 'string' },
              passage: { type: 'string' },
              question: { type: 'string' },
              choices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    text: { type: 'string' },
                  },
                  required: ['label', 'text'],
                  additionalProperties: false,
                },
              },
              answer: { type: 'string' },
              explanation: { type: 'string' },
              difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
              topic: { type: 'string' },
            },
            required: ['page', 'question', 'answer'],
            additionalProperties: false,
          },
        },
      },
      required: ['problems'],
      additionalProperties: false,
    },
    maxTokens: 64000,
  });
  return problems ?? [];
}

function buildProblemEmbedText(p: {
  subject: string;
  topic: string | null;
  difficulty: string | null;
  problem_type: string;
  question: string;
  choices: Choice[] | null;
  answer: string;
  explanation: string | null;
}): string {
  const parts: string[] = [];
  const meta: string[] = [`과목:${p.subject}`];
  if (p.topic) meta.push(`단원:${p.topic}`);
  if (p.difficulty) meta.push(`난이도:${p.difficulty}`);
  meta.push(`유형:${p.problem_type}`);
  parts.push(`[${meta.join(' / ')}]`);
  parts.push(p.question);
  if (p.choices?.length) {
    parts.push(p.choices.map((c) => `${c.label}. ${c.text}`).join('\n'));
  }
  parts.push(`정답: ${p.answer}`);
  if (p.explanation) parts.push(`해설: ${p.explanation}`);
  return parts.join('\n\n');
}

async function ensureSchool(name: string): Promise<string> {
  const supabase = getSupabaseServer();
  const { data: existing } = await supabase
    .from('schools')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from('schools')
    .insert({ name, description: `${name} 시험대비 자료` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`school insert failed: ${error?.message}`);
  console.log(`  + 학교 생성: ${name}`);
  return data.id as string;
}

async function ingestOne(args: {
  filePath: string;
  answerPath: string | null;
  schoolId: string;
  /** 지문 참조 문제에 passage가 비어있는 소스만 골라 문제를 재추출. */
  repairPassages?: boolean;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const filename = nfc(path.basename(args.filePath));

  const buf = fs.readFileSync(args.filePath);

  // Resume support: a previous run may have left this source in
  // failed/pending state (e.g. embedding quota) — re-index instead of skip.
  const { data: dup } = await supabase
    .from('sources')
    .select('id, indexing_status, subject, subjects, title, units')
    .eq('original_filename', filename)
    .maybeSingle();

  let sourceId: string;
  let meta: Pick<SourceMeta, 'title' | 'subject' | 'subjects' | 'units'>;

  if (dup && dup.indexing_status === 'ready') {
    console.log(`  ↷ 인덱싱 완료된 소스 재사용: ${dup.title}`);
    sourceId = dup.id as string;
    meta = {
      title: dup.title as string,
      subject: dup.subject as string,
      subjects: (dup.subjects ?? []) as string[],
      units: (dup.units ?? []) as string[],
    };
  } else if (dup) {
    console.log(`  ↻ 이전 실행 재개 (status=${dup.indexing_status}) — 재인덱싱`);
    sourceId = dup.id as string;
    meta = {
      title: dup.title as string,
      subject: dup.subject as string,
      subjects: (dup.subjects ?? []) as string[],
      units: (dup.units ?? []) as string[],
    };
    await supabase.from('source_chunks').delete().eq('source_id', sourceId);
    const idx = await indexSource(sourceId);
    console.log(
      `     → ${idx.totalPages}p, 청크 ${idx.chunks}개${idx.needsOcr ? ' (OCR 사용)' : ''}`,
    );
  } else {
    console.log(`  ① 메타데이터 추론 중…`);
    const inferred = await inferMetadata(buf, filename);
    console.log(
      `     → ${inferred.title} | ${inferred.subject} ${inferred.grade} ${inferred.source_type}`,
    );
    meta = inferred;

    const storagePath = `${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('sources')
      .upload(storagePath, buf, { contentType: 'application/pdf', upsert: false });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

    const { data: src, error: insErr } = await supabase
      .from('sources')
      .insert({
        title: inferred.title,
        source_type: inferred.source_type,
        subject: inferred.subject,
        subjects: inferred.subjects?.length ? inferred.subjects : [inferred.subject],
        grade: inferred.grade,
        publisher: inferred.publisher ?? null,
        description: inferred.description,
        units: inferred.units,
        tags: inferred.tags,
        file_path: storagePath,
        original_filename: filename,
        file_size_bytes: buf.byteLength,
        indexing_status: 'pending',
        school_id: args.schoolId,
      })
      .select('id')
      .single();
    if (insErr || !src) throw new Error(`source insert failed: ${insErr?.message}`);
    sourceId = src.id as string;

    console.log(`  ② 인덱싱(필요시 Claude OCR) 중…`);
    const idx = await indexSource(sourceId);
    console.log(
      `     → ${idx.totalPages}p, 청크 ${idx.chunks}개${idx.needsOcr ? ' (OCR 사용)' : ''}`,
    );
  }

  if (!isProblemPdf(filename)) return;

  // Resume support: skip problem extraction if this source already has them —
  // unless repair mode finds passage-referencing problems without a passage.
  const { data: existingRows } = await supabase
    .from('problems')
    .select('id, question, passage')
    .eq('created_by', 'ingest-script')
    .contains('citations', JSON.stringify([{ sourceId }]));
  const existing = existingRows ?? [];
  if (existing.length > 0) {
    const broken = existing.filter(
      (p) =>
        /윗글|밑줄|빈칸|다음\s*글/.test(p.question as string) &&
        !(p.passage as string | null),
    );
    if (!args.repairPassages || broken.length === 0) {
      console.log(`  ↷ 문제 ${existing.length}개 이미 등록됨 — 추출 스킵`);
      return;
    }
    console.log(
      `  ♻ 지문 누락 ${broken.length}/${existing.length}개 — 기존 문제 삭제 후 재추출`,
    );
    const { error: delErr } = await supabase
      .from('problems')
      .delete()
      .in('id', existing.map((p) => p.id as string));
    if (delErr) throw new Error(`problems delete failed: ${delErr.message}`);
  }

  console.log(`  ③ 문제 추출·판독 중… ${args.answerPath ? '(정답지 페어)' : '(정답 AI 판독)'}`);
  const answerBuf = args.answerPath ? fs.readFileSync(args.answerPath) : null;
  const problems = await extractProblems(buf, answerBuf);
  if (problems.length === 0) {
    console.log('     → 추출된 문제 없음');
    return;
  }

  // Shared-passage groups → one passage_set_id per passageKey.
  const setIds = new Map<string, string>();
  for (const p of problems) {
    if (p.passageKey && !setIds.has(p.passageKey)) {
      setIds.set(p.passageKey, crypto.randomUUID());
    }
  }

  const notes = args.answerPath
    ? `자동 인제스트 (정답지: ${path.basename(args.answerPath)})`
    : '정답 AI 판독 — 검수 필요';

  const rows = problems.map((p) => ({
    subject: meta.subject,
    subjects: meta.subjects?.length ? meta.subjects : [meta.subject],
    topic: p.topic ?? meta.units[0] ?? null,
    difficulty: p.difficulty ?? 'medium',
    problem_type: p.choices?.length ? 'objective' : 'short',
    passage: p.passage ?? null,
    passage_set_id: p.passageKey ? setIds.get(p.passageKey) : null,
    question: p.question,
    choices: p.choices?.length ? p.choices : null,
    answer: p.answer,
    explanation: p.explanation ?? null,
    citations: [
      {
        sourceId,
        sourceTitle: meta.title,
        page: p.page,
        snippet: (p.passage ?? p.question).slice(0, 160),
      },
    ],
    notes,
    created_by: 'ingest-script',
  }));

  const { data: inserted, error: probErr } = await supabase
    .from('problems')
    .insert(rows)
    .select('id');
  if (probErr || !inserted) throw new Error(`problems insert failed: ${probErr?.message}`);

  console.log(`  ④ 문제 ${inserted.length}개 등록, 임베딩 중…`);
  const embedInputs = rows.map((r) =>
    buildProblemEmbedText({
      subject: r.subject,
      topic: r.topic,
      difficulty: r.difficulty,
      problem_type: r.problem_type,
      question: r.question,
      choices: r.choices,
      answer: r.answer,
      explanation: r.explanation,
    }),
  );
  const vectors = await embedTexts(embedInputs);
  for (let i = 0; i < inserted.length; i++) {
    const { error: embErr } = await supabase
      .from('problems')
      .update({
        embedding: vectors[i] as unknown as string,
        embedded_at: new Date().toISOString(),
      })
      .eq('id', inserted[i].id);
    if (embErr) console.error(`     ! 임베딩 저장 실패 (${inserted[i].id}): ${embErr.message}`);
  }
  console.log(`     → 완료`);
}

async function main() {
  const argv = process.argv.slice(2);
  const only: string | null = (() => {
    const i = argv.indexOf('--only');
    return i >= 0 ? argv[i + 1] ?? null : null;
  })();
  const school: string = (() => {
    const i = argv.indexOf('--school');
    return i >= 0 ? argv[i + 1] ?? SCHOOL_DEFAULT : SCHOOL_DEFAULT;
  })();
  const repairPassages = argv.includes('--repair-passages');
  const folders = argv.filter(
    (a, i) => !a.startsWith('--') && argv[i - 1] !== '--only' && argv[i - 1] !== '--school',
  );
  if (folders.length === 0) {
    console.error(
      'usage: tsx scripts/ingest-exam-pdfs.ts <folder...> [--only substr] [--school name] [--repair-passages]',
    );
    process.exit(1);
  }

  const pdfs = folders
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((f) => /\.pdf$/i.test(f))
        .map((f) => path.join(dir, f)),
    )
    .filter((f) => !only || path.basename(f).toLowerCase().includes(only.toLowerCase()));

  const answers = new Map<string, string>(); // stem → answer pdf path
  for (const f of pdfs) {
    if (isAnswerPdf(path.basename(f))) answers.set(pairStem(f), f);
  }
  const targets = pdfs.filter((f) => !isAnswerPdf(path.basename(f)));

  console.log(`대상 PDF ${targets.length}개 (정답지 ${answers.size}개 페어링), 학교: ${school}`);
  const schoolId = await ensureSchool(school);

  let failed = 0;
  for (const f of targets) {
    const name = path.basename(f);
    console.log(`\n■ ${name}`);
    try {
      await ingestOne({
        filePath: f,
        answerPath: answers.get(pairStem(f)) ?? null,
        schoolId,
        repairPassages,
      });
    } catch (e) {
      failed++;
      console.error(`  ✗ 실패: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n완료: ${targets.length - failed}/${targets.length} 성공`);
  if (failed > 0) process.exit(1);
}

main();
