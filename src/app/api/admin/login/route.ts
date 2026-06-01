import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE } from '@/shared/config/admin';
import { createSessionToken, verifyPassword } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 400 });
  }

  const email = parsed.email.trim().toLowerCase();
  const supabase = getSupabaseServer();
  const { data: user } = await supabase
    .from('admin_users')
    .select('id, password_hash')
    .eq('email', email)
    .maybeSingle();

  if (!user || !verifyPassword(parsed.password, user.password_hash)) {
    return NextResponse.json(
      { message: '이메일 또는 비밀번호가 일치하지 않습니다.' },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
}
