import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { giftLabel } from '@/entities/response';
import { listResponses } from '@/entities/response/api/listResponses';
import { formatAnswer, parts, questions } from '@/entities/survey';
import { getSessionUserId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmtTs(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fnameTs() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function GET() {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const rows = await listResponses();

  const orderedQuestionIds = parts
    .filter((p) => p.id !== 'CONSENT')
    .flatMap((p) => p.questionIds);

  const headers: string[] = [
    '응답 ID',
    '제출 일시',
    '상태',
    '상품권',
    '이름',
    '연락처',
    '소속',
    '이메일',
    'User-Agent',
    ...orderedQuestionIds.map((qid) => {
      const q = questions[qid];
      return q ? `${qid} · ${q.title}` : qid;
    }),
  ];

  const aoa: (string | number)[][] = [headers];
  for (const r of rows) {
    const meta: (string | number)[] = [
      r.id,
      fmtTs(r.created_at),
      r.status,
      r.gift ? giftLabel[r.gift] : '',
      r.name ?? '',
      r.phone ?? '',
      r.affiliation ?? '',
      r.email ?? '',
      r.user_agent ?? '',
    ];
    const answerCells = orderedQuestionIds.map((qid) =>
      formatAnswer(qid, r.answers?.[qid]),
    );
    aoa.push([...meta, ...answerCells]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h, i) => ({
    wch: i < 9 ? Math.max(14, h.length + 2) : Math.min(48, Math.max(20, h.length)),
  }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '응답');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="seolmun-responses-${fnameTs()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
