# PRD — AI 학습 에이전트 (국사 RAG)

## 1. Problem

국사 교사가 좋은 문제를 만드는 데 시간이 너무 많이 든다. 교과서/기출/문제집을 펼쳐 놓고 단원·난이도에 맞게 구성하고, 출처를 표시하고, 학생별 답안을 평가하고, 어떤 단원이 약한지 파악하는 일이 전부 손작업이다. 시중 AI는 출처가 없어 학교 현장에서 그대로 쓰기 어렵다 (저작권·신뢰성).

## 2. Users

- **교사/운영자** (어드민): PDF로 가진 교재·기출을 업로드하고, 채팅으로 단원/난이도/유형을 지시해 문제 세트를 받고, 학생 답안을 평가받고, 학생별 실력 리포트를 본다.

*(학생 UI는 본 MVP 범위 밖)*

## 3. Goals

- 어드민이 채팅 1~5회 안에 출처 표기된 문제 3~10개 세트를 받는다.
- 모든 생성 문제에 **소스 PDF + 페이지 번호** 인용이 붙는다.
- 학생 답안을 입력하면 정/오답 + 부분 점수 + 피드백.
- 학생별 누적 답안으로 **단원별 실력 점수(0~100)** 자동 산출.
- PDF 업로드 → 인덱싱 완료까지 평균 1MB당 30초 이내.

## 4. Non-Goals (MVP)

학생 직접 접근, 다과목(수학·영어 등), 음성/이미지 입력, 결제, 협업, fine-tuning.

## 5. User Stories

1. **소스 업로드** — "한국사 교과서 미래엔 2024.pdf" 업로드 → 인덱싱 상태 표시 → 완료 시 라이브러리 노출.
2. **문제 생성** — "고1 한국사 임진왜란 객관식 5문제" → 5문제 + 각 문제에 `[교과서 p.42]` 같은 인용.
3. **소스 좁히기** — 라이브러리에서 특정 PDF 핀 → 해당 PDF에서만 retrieval.
4. **답안 평가** — 학생 답안 입력 → 정/오답 + 점수 + 잘 한 점/부족한 점.
5. **실력 리포트** — "학생 이수아 실력" → 단원별 점수 + 약점 단원.
6. **편집/저장** — 생성된 문제 검수 → 저장 → 라이브러리 보관, 평가에서 재호출.

## 6. Functional Requirements

### 6.1 라우터 (`POST /api/agent/chat`)

어드민 쿠키 가드. 자유 텍스트 + 핀된 소스 ID + 학생 ID(옵션) 받음.

Gemini `gemini-2.5-flash` **function calling**으로 4개 툴 중 하나(혹은 다수) 호출 → 결과를 자연어 답변 + 구조화 페이로드 + 인용으로 직렬화.

### 6.2 Tools

| Tool | 입력 | 출력 |
|---|---|---|
| `search_source` | `{ query, k? }` | `chunks: { id, sourceId, page, content, similarity }[]` |
| `generate_problem` | `{ topic?, difficulty?, count?, type?, gradeHint? }` | `problems: ProblemDraft[]` (인용 포함) |
| `evaluate_answer` | `{ problemId, studentAnswer, studentId? }` | `{ isCorrect, score(0~1), feedback }` (attempt 저장) |
| `assess_level` | `{ studentId, scope?, topic? }` | `{ levelOverall, byTopic: { topic, score, samples }[] }` |

각 툴 zod 입력 스키마. 부적합 인자는 400.

### 6.3 PDF 업로드 & 인덱싱 (`POST /api/agent/sources`)

multipart. 어드민 쿠키 가드.

**메타데이터 필드**
- 필수: `title`, `source_type` (교과서/문제집/기출/요약본/강의자료/기타), `subject` (default 국사)
- 선택: `grade` (중1~고3), `publisher`, `year`, `description`
- 자동: `file_path`, `file_size_bytes`, `total_pages`, `original_filename`, `indexing_status`, `chunk_count`

**파이프라인 (동기, MVP)**
1. Supabase Storage `sources` 버킷 업로드
2. `pdf-parse`로 페이지별 텍스트 추출
3. 페이지 텍스트를 ~800자 청크 + 100자 overlap 분할
4. Gemini `text-embedding-004` 임베딩 (배치 100건)
5. `source_chunks` insert (`vector(768)`)
6. `indexing_status = ready`

50MB / 200페이지 한도. 초과 또는 텍스트 0건 → `failed`.

### 6.4 인용

청크 단위 `{ sourceId, page, snippet, similarity }`. 문제 카드 하단에 `📖 출처` + 「제목」 p.42 칩. 클릭 시 사이드 드로어에서 PDF.js로 해당 페이지 미리보기 (signed URL 사용).

### 6.5 학생 답안 / 실력

`studentAnswer + studentId` → Gemini로 채점 (객관식 정답 비교 + 서술형 점수/피드백) → `student_attempts` 저장. 명시적 "실력 측정" 시 `student_levels` 갱신, 단원별 가중 평균(난이도 weight: easy 1, med 1.5, hard 2).

### 6.6 어드민 UI (`/admin/agent`)

- 좌측: 대화 목록 + "새 대화"
- 중앙: 메시지 스레드 (사용자 / 에이전트 — 에이전트 답에는 ProblemCard / EvaluationCard / LevelCard 렌더)
- 하단: textarea + 📎 소스 핀 + 전송
- 우측 드로어: 소스 라이브러리 (PDF 목록/업로드/상태/삭제/재인덱싱)
- 기존 `/admin` 헤더에 "🤖 에이전트" 링크

## 7. Data Model 요약

```
sources              (id, title, source_type, subject, grade, publisher, year,
                      file_path, total_pages, chunk_count, indexing_status, …)
source_chunks        (id, source_id, page_number, chunk_index, content,
                      embedding vector(768))
problems             (id, subject, topic, difficulty, problem_type,
                      question, choices, answer, explanation,
                      citations jsonb, conversation_id)
student_attempts     (id, problem_id, student_id, student_answer,
                      is_correct, score, feedback)
student_levels       (id, student_id, subject, topic, score, samples,
                      updated_at)            unique(student_id, subject, topic)
agent_conversations  (id, title, created_at)
agent_messages       (id, conversation_id, role, content jsonb,
                      pinned_source_ids uuid[], student_id)
```

+ `match_source_chunks(query_embedding vector, match_count int, filter_source_ids uuid[])` RPC for cosine-sim top-k.

## 8. API

| Method | Path | 가드 | 용도 |
|---|---|---|---|
| POST | `/api/agent/chat` | admin | 라우터 진입 + 툴 호출 |
| GET/POST | `/api/agent/sources` | admin | 소스 목록 / 업로드 |
| DELETE/POST | `/api/agent/sources/[id][/reindex]` | admin | 삭제 / 재인덱싱 |
| GET | `/api/agent/sources/[id]/signed-url` | admin | PDF.js용 서명 URL |
| GET | `/api/agent/conversations[/[id]]` | admin | 대화/메시지 |

## 9. Non-functional

- p95 retrieval < 1s, generation < 10s
- PDF 50MB / 200페이지 한도
- 모든 어드민 API 쿠키 401 가드
- `GEMINI_API_KEY` 서버 전용 (`NEXT_PUBLIC_` 접두어 X)
- 한국어 UTF-8 보존

## 10. Risks

- 한국어 PDF 텍스트 추출 정확도 — 검증 후 필요시 `pdfjs-dist` Node 빌드로 대체
- Gemini 무료 한도(RPM 60 / RPD 1500) — 어드민 1~2명 MVP는 충분
- 50MB·200페이지 초과 — 추후 백그라운드 큐로 분리
