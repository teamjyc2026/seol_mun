/**
 * 과목별 분류 체계 — PDF 워크벤치 등에서 "고르는" 형태의 토픽 선택에 사용.
 * 대분류(category) → 토픽(topics). 토픽은 평면 문자열이거나, 하위(sub)를 가진
 * 3단계 노드(예 문법: 시제 → 현재완료/과거완료/…). 목록에 없는 과목은 직접 입력 폴백.
 *
 * 저장은 단일 `topic` text에 **쉼표로 구분된 다중 태그**로 한다. 3단계 태그는
 * `상위 > 하위`(예 "시제 > 현재완료"), 평면은 그대로. 다중이면 "시제 > 현재완료, 관계대명사".
 */
export type TopicNode = string | { topic: string; sub: string[] };
export type TopicCategory = { category: string; topics: TopicNode[] };

/** 태그(상위>하위) 구분자 / 다중 태그 구분자. */
export const TOPIC_PATH_SEP = ' > ';
export const TOPIC_TAG_SEP = ', ';

export const TOPIC_TAXONOMY: Record<string, TopicCategory[]> = {
  영어: [
    {
      category: '문법',
      topics: [
        { topic: '시제', sub: ['현재완료', '과거완료', '과거진행', '현재진행', '미래', '미래완료'] },
        { topic: '가정법', sub: ['가정법 과거', '가정법 과거완료', '혼합 가정법', 'I wish', 'as if'] },
        { topic: 'to부정사', sub: ['명사적 용법', '형용사적 용법', '부사적 용법', '의미상 주어', '가주어/진주어'] },
        '동명사',
        { topic: '분사/분사구문', sub: ['현재분사', '과거분사', '분사구문', 'with 분사구문'] },
        { topic: '관계대명사', sub: ['주격/목적격', '소유격(whose)', 'what', '관계대명사 생략', '계속적 용법'] },
        '관계부사',
        { topic: '수동태', sub: ['기본 수동태', '4·5형식 수동태', '진행/완료 수동태', 'by 이외 전치사'] },
        { topic: '조동사', sub: ['can/could', 'must/have to', 'should', 'would/used to', '조동사+have p.p.'] },
        { topic: '비교', sub: ['원급', '비교급', '최상급', '비교 관용'] },
        '수일치',
        '도치',
        '간접의문문',
        '접속사',
        '전치사',
        '명사절',
        '부사절',
      ],
    },
    {
      category: '어휘',
      topics: ['문맥 어휘', '동의어/반의어', '연어', '숙어', '파생어', '영영풀이'],
    },
    {
      category: '독해',
      topics: [
        '주제/요지',
        '제목',
        '내용일치',
        '빈칸추론',
        '순서배열',
        '문장삽입',
        '함의추론',
        '요약문',
        '심경/분위기',
      ],
    },
    {
      category: '듣기/말하기',
      topics: ['대화 의도', '세부정보', '상황 추론', '응답 고르기'],
    },
    {
      category: '본문',
      topics: ['본문 해석', '본문 암기', '핵심 구문', '단원 정리'],
    },
  ],
  국어: [
    { category: '문학', topics: ['시', '소설', '수필/극', '고전시가', '고전산문'] },
    { category: '비문학', topics: ['인문', '사회', '과학', '기술', '예술'] },
    { category: '문법', topics: ['음운', '단어', '문장', '담화', '국어사'] },
  ],
  수학: [
    { category: '대수', topics: ['다항식', '방정식', '부등식', '함수', '수열'] },
    { category: '기하', topics: ['도형의 성질', '좌표평면', '벡터'] },
    { category: '해석', topics: ['극한', '미분', '적분'] },
    { category: '확률과 통계', topics: ['경우의 수', '확률', '통계'] },
  ],
};

export function topicCategoriesFor(subject: string): TopicCategory[] {
  return TOPIC_TAXONOMY[subject] ?? [];
}

/** 토픽 노드의 라벨(상위 이름). */
export function topicNodeLabel(n: TopicNode): string {
  return typeof n === 'string' ? n : n.topic;
}

/** 한 노드가 만들 수 있는 유효 태그들 (평면=자기, 3단계=상위 + 상위>하위들). */
function tagsForNode(n: TopicNode): string[] {
  if (typeof n === 'string') return [n];
  return [n.topic, ...n.sub.map((s) => `${n.topic}${TOPIC_PATH_SEP}${s}`)];
}

/** 과목의 모든 유효 태그(평탄화) 집합 — OCR 스냅·검증용. */
export function topicLeafPaths(subject: string): Set<string> {
  const out = new Set<string>();
  for (const c of topicCategoriesFor(subject)) {
    for (const t of c.topics) for (const tag of tagsForNode(t)) out.add(tag);
  }
  return out;
}

/** 태그(상위>하위 또는 평면)의 대분류(category)를 찾는다. UI 탐색 하이라이트용. */
export function categoryForTag(subject: string, tag: string): string | null {
  const top = tag.split(TOPIC_PATH_SEP)[0].trim();
  for (const c of topicCategoriesFor(subject)) {
    if (c.topics.some((t) => topicNodeLabel(t) === top)) return c.category;
  }
  return null;
}

/** 쉼표 다중 태그 문자열을 유효 태그만 남겨 정규화. 유효 분류가 없는 과목이면 원문 유지. */
export function normalizeTopicTags(subject: string, raw: string): string {
  const valid = topicLeafPaths(subject);
  if (valid.size === 0) return raw.trim();
  const tags = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => valid.has(s));
  return Array.from(new Set(tags)).join(TOPIC_TAG_SEP);
}
