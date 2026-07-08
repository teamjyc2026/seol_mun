import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { TYPES } from '@/entities/enneagram';
import { listEnneagram } from '@/entities/enneagram/server';
import { isAdmin } from '@/shared/config/auth';

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
  if (!(await isAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const rows = await listEnneagram();

  const typeCols = Array.from({ length: 9 }, (_, i) => {
    const t = i + 1;
    return `유형${t}${TYPES[t].name}`;
  });

  const headers: string[] = [
    '제출일시',
    '이름',
    '학교',
    '학년',
    '전화번호',
    ...typeCols,
    '총점',
    '주요기질',
    '서브기질',
  ];

  const aoa: (string | number)[][] = [headers];
  for (const r of rows) {
    const scoreCells = Array.from(
      { length: 9 },
      (_, i) => r.scores?.[String(i + 1)] ?? 0,
    );
    aoa.push([
      fmtTs(r.created_at),
      r.name ?? '',
      r.school ?? '',
      r.grade ?? '',
      r.phone ?? '',
      ...scoreCells,
      r.total,
      TYPES[r.top_type]?.name ?? String(r.top_type),
      TYPES[r.sub_type]?.name ?? String(r.sub_type),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(10, h.length + 2) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '에니어그램');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="enneagram-${fnameTs()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
