import { NextResponse, type NextRequest } from 'next/server';
import { responsePayloadSchema } from '@/entities/response';
import { isAdmin } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only manual entry. Bypasses the public cap so paper or offline
 * responses can be recorded after the public survey closes.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = responsePayloadSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { message: '잘못된 요청 형식입니다.', details: String(e) },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('responses')
      .insert({
        privacy_agreed: parsed.consent.privacy_agreed,
        name: parsed.consent.name,
        phone: parsed.consent.phone,
        affiliation: parsed.consent.affiliation,
        email: parsed.consent.email,
        answers: parsed.answers,
        gift: parsed.gift,
        status: 'submitted',
        user_agent: 'admin-manual',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[POST /api/admin/responses] supabase error', error);
      return NextResponse.json(
        { message: '저장 중 오류가 발생했습니다.', details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/admin/responses] server error', e);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
