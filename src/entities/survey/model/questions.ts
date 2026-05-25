import type { Question, QuestionId } from './types';

const grades = ['중1', '중2', '중3', '고1', '고2', '고3'];
const opt = (raw: string[]) =>
  raw.map((label, i) => ({ value: `${i + 1}`, label }));

const list: Question[] = [
  // Part 1
  {
    id: 'Q1',
    partId: 'P1',
    type: 'single',
    title: '현재 학년은 어떻게 되시나요?',
    options: grades.map((g) => ({ value: g, label: g })),
  },
  {
    id: 'Q2',
    partId: 'P1',
    type: 'single',
    title: '성별을 알려주세요.',
    options: opt(['남자', '여자', '응답 안함']),
  },
  {
    id: 'Q3',
    partId: 'P1',
    type: 'single',
    title: '현재 거주 지역은 어디인가요?',
    options: opt([
      '서울',
      '경기/인천',
      '광역시(부산/대구/광주/대전/울산)',
      '그 외 시·도',
    ]),
  },
  {
    id: 'Q4',
    partId: 'P1',
    type: 'single',
    title: '본인의 전체 성적은 학교/학년에서 어느 정도인가요?',
    options: opt([
      '상위 10% 이내',
      '상위 30% 이내',
      '중위권 (30~70%)',
      '하위 30%',
      '잘 모르겠다',
    ]),
  },
  {
    id: 'Q5',
    partId: 'P1',
    type: 'short',
    title: '가장 자신 있는 과목과 가장 어려운 과목을 각각 적어주세요.',
    placeholder: '예) 자신 있는 과목: 영어 / 어려운 과목: 수학',
  },

  // Part 2
  {
    id: 'Q6',
    partId: 'P2',
    type: 'multi',
    title: '현재 받고 있는 사교육의 형태를 모두 선택해 주세요.',
    options: opt([
      '학원 (그룹)',
      '학원 (소수정예)',
      '1대1 과외',
      '인터넷 강의 (인강)',
      'AI 학습 앱',
      '학습지 (방문/구독)',
      '받지 않음',
    ]),
  },
  {
    id: 'Q7',
    partId: 'P2',
    type: 'short',
    title: '주중 평일 기준, 학교 수업을 제외한 하루 평균 공부시간은?',
    placeholder: '예) 3시간 30분',
  },
  {
    id: 'Q8',
    partId: 'P2',
    type: 'short',
    title: '한 달 사교육비는 대략 얼마인가요?',
    placeholder: '예) 80만원',
  },
  {
    id: 'Q9',
    partId: 'P2',
    type: 'scale',
    title:
      '현재 받고 있는 사교육(또는 학습방법)에 전반적으로 만족한다.',
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q10',
    partId: 'P2',
    type: 'single',
    title: '스스로 공부할 때 주로 사용하는 도구는 무엇인가요?',
    options: opt([
      '종이 문제집/참고서',
      '학원/인강 교재',
      '학습 앱 (EBS, 콴다 등)',
      '유튜브',
      'ChatGPT 등 생성형 AI',
      '기타',
    ]),
  },

  // Part 3
  {
    id: 'Q11',
    partId: 'P3',
    type: 'multi',
    title: '공부할 때 가장 큰 어려움은 무엇인가요?',
    helper: '최대 3개까지 선택할 수 있어요.',
    maxSelect: 3,
    options: opt([
      '개념이 이해되지 않음',
      '문제풀이에 적용이 안됨',
      '모르는 것을 물어볼 사람이 없음',
      '틀린 문제 원인을 모름',
      '집중이 잘 안됨',
      '학습량이 너무 많음',
      '무엇을 공부해야 할지 모름',
      '기타',
    ]),
  },
  {
    id: 'Q12',
    partId: 'P3',
    type: 'scale',
    title:
      '모르는 문제를 만났을 때 즉시 질문할 사람이 없어 답답한 적이 있다.',
    scale: { min: 1, max: 5, minLabel: '매우 그렇다', maxLabel: '매우 그렇지 않다' },
  },
  {
    id: 'Q13',
    partId: 'P3',
    type: 'scale',
    title:
      "선생님/강사가 정답을 알려주지만, '왜 그렇게 푸는지'는 잘 이해되지 않는다고 느낀 적이 있다.",
    scale: { min: 1, max: 5, minLabel: '매우 그렇다', maxLabel: '매우 그렇지 않다' },
  },
  {
    id: 'Q14',
    partId: 'P3',
    type: 'scale',
    title: '같은 유형의 문제를 반복해서 틀리는 경우가 자주 있다.',
    scale: { min: 1, max: 5, minLabel: '매우 그렇다', maxLabel: '매우 그렇지 않다' },
  },
  {
    id: 'Q15',
    partId: 'P3',
    type: 'scale',
    title: '공부한 내용을 문제풀이에 적용하기 어렵다.',
    scale: { min: 1, max: 5, minLabel: '매우 그렇다', maxLabel: '매우 그렇지 않다' },
  },
  {
    id: 'Q16',
    partId: 'P3',
    type: 'long',
    title:
      "공부할 때 '이런 게 있었으면 좋겠다'고 느낀 도움이나 기능이 있다면 자유롭게 적어주세요.",
    optional: true,
    placeholder: '자유롭게 적어주세요 (선택)',
  },

  // Part 4
  {
    id: 'Q17',
    partId: 'P4',
    type: 'single',
    title:
      'ChatGPT, Gemini, Claude 등 생성형 AI를 학습에 사용해 본 경험이 있나요?',
    options: opt([
      '자주 사용한다 (주 3회 이상)',
      '가끔 사용한다',
      '한두 번 사용해봤다',
      '사용해본 적 없다',
    ]),
  },
  {
    id: 'Q18',
    partId: 'P4',
    type: 'multi',
    title:
      'AI를 사용해 본 경험이 있다면, 주로 어떤 용도로 사용했나요? (모두 선택)',
    options: opt([
      '모르는 개념 설명 듣기',
      '문제 풀이 / 정답 확인',
      '글쓰기 / 요약',
      '영어 회화·번역',
      '코딩',
      '진로 / 공부방법 상담',
      '시험 대비 문제 생성',
      '사용해본 적 없음',
    ]),
  },
  {
    id: 'Q19',
    partId: 'P4',
    type: 'scale',
    title:
      "AI가 알려주는 답을 그대로 받아쓰기보다, AI가 '질문을 던져주면서' 스스로 답을 찾게 해주면 더 도움이 될 것 같다.",
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q20',
    partId: 'P4',
    type: 'scale',
    title:
      "지금까지 사용해 본 AI 학습도구는 '진짜로 내 수준에 맞춰' 가르쳐주는 느낌이 든다.",
    helper: '사용 경험이 없으면 비워두세요.',
    scale: {
      min: 1,
      max: 5,
      minLabel: '전혀 아니다',
      maxLabel: '매우 그렇다',
      allowEmpty: true,
    },
    optional: true,
  },
  {
    id: 'Q21',
    partId: 'P4',
    type: 'long',
    title:
      'AI 학습도구를 사용하면서 아쉬웠던 점, 또는 개선되었으면 하는 점을 적어주세요.',
    optional: true,
    placeholder: '자유롭게 적어주세요 (선택)',
  },

  // Part 5
  {
    id: 'Q22',
    partId: 'P5',
    type: 'scale',
    title:
      '선생님이 정답을 바로 알려주기보다, 질문을 통해 스스로 답을 찾게 도와주는 수업이 더 효과적이라고 생각한다.',
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q23',
    partId: 'P5',
    type: 'scale',
    title:
      "'왜 그렇게 생각했어?'라는 질문을 받았을 때, 내 사고를 정리하는 데 도움이 된다.",
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q24',
    partId: 'P5',
    type: 'scale',
    title:
      '정답을 듣는 것보다, 내가 틀린 과정을 같이 다시 짚어주는 학습이 더 오래 기억에 남는다.',
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q25',
    partId: 'P5',
    type: 'rank',
    title:
      '다음 4단계 중 본인에게 가장 필요하다고 생각하는 단계를 1순위~4순위로 매겨주세요.',
    helper: '카드를 누른 순서대로 순위가 매겨집니다. 다시 누르면 해제됩니다.',
    rank: { max: 4, allOptions: true },
    options: [
      { value: 'Think', label: 'Think — 스스로 먼저 생각하기' },
      { value: 'Why', label: 'Why — 왜 그렇게 풀었는지 설명하기' },
      { value: 'Rebuild', label: 'Rebuild — 개념을 내 말로 재구성하기' },
      { value: 'Transfer', label: 'Transfer — 다른 문제/상황에 적용하기' },
    ],
  },

  // Part 6
  {
    id: 'Q26',
    partId: 'P6',
    type: 'scale',
    title:
      "AI가 정답이 아닌 단계별 질문을 던지고, 스스로 풀이를 완성하도록 돕는 1대1 튜터링 서비스가 출시된다면 사용해보고 싶다.",
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q27',
    partId: 'P6',
    type: 'multi',
    title: '이 서비스에서 가장 필요하다고 생각되는 기능을 모두 골라주세요.',
    options: opt([
      '단계별 힌트 질문 제공',
      '풀이과정을 음성/이미지로 입력',
      '틀린 원인 자동 분석 리포트',
      '약점 단원 맞춤 문제 추천',
      '학부모/선생님과 학습 결과 공유',
      '캐릭터 / 게이미피케이션',
      '실시간 화상 질의응답',
      '시험 대비 모의 문제 생성',
    ]),
  },
  {
    id: 'Q28',
    partId: 'P6',
    type: 'single',
    title: '가장 사용하고 싶은 과목은 무엇인가요?',
    options: opt([
      '수학',
      '영어',
      '국어',
      '과학',
      '사회',
      '코딩 / 논리력',
      '자기주도학습 코칭',
    ]),
  },
  {
    id: 'Q29',
    partId: 'P6',
    type: 'single',
    title: '어떤 디바이스에서 주로 사용할 것 같나요?',
    options: opt(['스마트폰', '태블릿', '노트북/PC', '모든 기기']),
  },
  {
    id: 'Q30',
    partId: 'P6',
    type: 'rank',
    title:
      '하루 중 주로 사용할 시간대는 언제인가요? 가장 사용시간이 많을 시간대 3개를 순서대로 골라주세요.',
    helper: '카드를 누른 순서대로 1·2·3순위가 매겨집니다.',
    rank: { max: 3, allOptions: false },
    options: opt([
      '등교 전 아침 (6시~8시)',
      '학교 쉬는 시간',
      '하교 후 ~ 저녁 (4시~10시)',
      '늦은 밤 자기 전 (10시~2시)',
      '주말',
    ]),
  },

  // Part 7
  {
    id: 'Q31',
    partId: 'P7',
    type: 'single',
    title:
      "AI 1대1 튜터 서비스의 월 구독료가 다음과 같다면, '너무 비싸서 사용 안 함'이라고 느껴지는 가격은?",
    options: opt(['2만원', '5만원', '8만원', '12만원', '20만원 이상']),
  },
  {
    id: 'Q32',
    partId: 'P7',
    type: 'single',
    title:
      "반대로, 다음 가격이라면 '품질이 의심되어 오히려 안 쓸 것 같다'고 느껴지는 가격은?",
    options: opt(['무료', '5천원', '1만원', '2만원', '3만원']),
  },
  {
    id: 'Q33',
    partId: 'P7',
    type: 'single',
    title: "'적정하다'고 느껴지는 월 구독료는?",
    options: opt(['1만원 이하', '1~3만원', '3~5만원', '5~10만원', '10만원 이상']),
  },
  {
    id: 'Q34',
    partId: 'P7',
    type: 'scale',
    title: '적정한 가격이면 학습 보조수단으로 사용해볼 의향이 있다.',
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },
  {
    id: 'Q35',
    partId: 'P7',
    type: 'scale',
    title: '월 적정 구독료라면 보호자에게 결제를 부탁해 볼 의향이 있다.',
    scale: { min: 1, max: 5, minLabel: '전혀 아니다', maxLabel: '매우 그렇다' },
  },

  // Part 8
  {
    id: 'Q36',
    partId: 'P8',
    type: 'long',
    title:
      "지금까지의 학습 경험에서 '이런 선생님이 옆에 있었으면 좋겠다'고 느꼈던 순간이 있다면 적어주세요.",
    optional: true,
    placeholder: '자유롭게 적어주세요 (선택)',
  },
  {
    id: 'Q37',
    partId: 'P8',
    type: 'long',
    title:
      'AI가 학습을 돕는다고 했을 때, 가장 우려되거나 불편할 것 같은 점은 무엇인가요?',
    optional: true,
    placeholder: '자유롭게 적어주세요 (선택)',
  },
  {
    id: 'Q38',
    partId: 'P8',
    type: 'long',
    title: '기타 의견이나 제안이 있다면 자유롭게 적어주세요.',
    optional: true,
    placeholder: '자유롭게 적어주세요 (선택)',
  },
  {
    id: 'Q39',
    partId: 'P8',
    type: 'single',
    title: 'AI 튜터 서비스에 좋은 이름을 선택해 주세요.',
    options: [
      { value: '나비', label: '나만의 비밀튜터 (나비)' },
      { value: 'AI똑똑', label: 'AI 똑똑' },
      { value: 'AI루미', label: 'AI 루미' },
      { value: 'AI유니카', label: 'AI 유니카' },
      { value: 'AI토코', label: 'AI 토코' },
      { value: '마이리', label: '마이리' },
      { value: 'AI모디', label: 'AI 모디' },
    ],
  },
];

export const questions: Record<QuestionId, Question> = Object.fromEntries(
  list.map((q) => [q.id, q]),
) as Record<QuestionId, Question>;

export const questionList = list;
