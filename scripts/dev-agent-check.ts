/**
 * 개발 검증용: 분류 라우팅 + Claude 응답 + 메모리 추출을 DB/UI 없이 점검.
 * 실행: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/dev-agent-check.ts
 */
import './load-env';
import crypto from 'node:crypto';
import { classifyAgent } from '@/shared/agent/agents/classify';
import { runAgent } from '@/shared/agent/router';
import { extractAndSaveMemories, loadMemories } from '@/shared/agent/memory';

async function main() {
  const cases: { msg: string; expect: string }[] = [
    { msg: '현재완료랑 과거시제 차이 알려줘', expect: 'grammar' },
    { msg: 'collocation이 무슨 뜻이야?', expect: 'vocab' },
    { msg: '심심해, 농담 하나 해줘 ㅋㅋ', expect: 'companion' },
    { msg: '시험 망쳐서 너무 우울해', expect: 'emotion' },
    { msg: '관계대명사 문제 찾아줘', expect: 'problem_finder' },
  ];
  console.log('=== 1) 라우팅 분류 ===');
  for (const c of cases) {
    const r = await classifyAgent(c.msg, { subject: '영어', audience: 'teacher' });
    const ok = r.agent === c.expect ? '✓' : `✗ (got ${r.agent})`;
    console.log(`  ${ok} "${c.msg}" → ${r.agent} [${r.via}]`);
  }

  console.log('\n=== 2) companion 턴 (Claude 응답) ===');
  const conv = crypto.randomUUID();
  const reply = await runAgent({
    conversationId: conv,
    message: '나 고양이 키우는데 이름이 모카야. 심심하니까 농담 하나 해줘 ㅋㅋ',
    pinnedSourceIds: [],
    studentId: 'dev-check',
    subject: '영어',
    audience: 'teacher',
  });
  console.log(`  agent=${reply.agent}`);
  console.log(`  text=${reply.text.slice(0, 200)}`);

  console.log('\n=== 3) 메모리 추출 ===');
  await extractAndSaveMemories({
    studentId: 'dev-check',
    agent: 'companion',
    userMessage: '나 고양이 키우는데 이름이 모카야. 심심하니까 농담 하나 해줘 ㅋㅋ',
    assistantText: reply.text,
  });
  const mems = await loadMemories('dev-check');
  for (const m of mems) console.log(`  - (${m.kind}) ${m.content}`);

  console.log('\n=== 4) emotion 턴 ===');
  const reply2 = await runAgent({
    conversationId: crypto.randomUUID(),
    message: '시험 망쳐서 너무 우울해...',
    pinnedSourceIds: [],
    studentId: 'dev-check',
    subject: '영어',
    audience: 'teacher',
  });
  console.log(`  agent=${reply2.agent}`);
  console.log(`  text=${reply2.text.slice(0, 200)}`);
}

main();
