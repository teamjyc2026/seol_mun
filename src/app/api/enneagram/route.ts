import { NextResponse, type NextRequest } from 'next/server';
import { computeScores, enneagramPayloadSchema } from '@/entities/enneagram';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = enneagramPayloadSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '잘못된 요청 형식입니다.', details: String(e) },
      { status: 400 },
    );
  }

  // 신뢰 경계: 점수·유형은 서버에서 answers로 재계산한다.
  const { scores, total, top, sub } = computeScores(parsed.answers);

  try {
    const supabase = getSupabaseServer();
    const userAgent = req.headers.get('user-agent') ?? null;
    const { data, error } = await supabase
      .from('enneagram_responses')
      .insert({
        name: parsed.info.name,
        school: parsed.info.school || null,
        grade: parsed.info.grade || null,
        phone: parsed.info.phone || null,
        answers: parsed.answers,
        scores,
        total,
        top_type: top,
        sub_type: sub,
        user_agent: userAgent,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[POST /api/enneagram] supabase error', error);
      return NextResponse.json(
        { message: '응답 저장 중 오류가 발생했습니다.', details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id, top, sub, scores, total }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/enneagram] server error', e);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
