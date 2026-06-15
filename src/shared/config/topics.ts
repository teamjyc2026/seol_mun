/**
 * 과목별 분류 체계 — PDF 워크벤치 등에서 "고르는" 형태의 토픽 선택에 사용.
 * 대분류(category) → 세부 토픽(topics). 목록에 없는 과목/토픽은 직접 입력 폴백.
 */
export type TopicCategory = { category: string; topics: string[] };

export const TOPIC_TAXONOMY: Record<string, TopicCategory[]> = {
  영어: [
    {
      category: '문법',
      topics: [
        'to부정사',
        '동명사',
        '분사/분사구문',
        '관계대명사',
        '관계부사',
        '가정법',
        '시제',
        '수동태',
        '조동사',
        '비교',
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
