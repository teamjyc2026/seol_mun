import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  answers: z.record(z.string(), z.any()),
  consent: z.object({
    privacy_agreed: z.literal(true),
    name: z.string().min(1).max(50),
    phone: z.string().min(1).max(20),
    affiliation: z.string().min(1).max(100),
    email: z.string().email(),
  }),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch (e) {
    return NextResponse.json(
      { message: '잘못된 요청 형식입니다.', details: String(e) },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServer();
    const userAgent = req.headers.get('user-agent') ?? null;
    const { data, error } = await supabase
      .from('responses')
      .insert({
        privacy_agreed: parsed.consent.privacy_agreed,
        name: parsed.consent.name,
        phone: parsed.consent.phone,
        affiliation: parsed.consent.affiliation,
        email: parsed.consent.email,
        answers: parsed.answers,
        status: 'submitted',
        user_agent: userAgent,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[POST /api/responses] supabase error', error);
      return NextResponse.json(
        { message: '응답 저장 중 오류가 발생했습니다.', details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/responses] server error', e);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
