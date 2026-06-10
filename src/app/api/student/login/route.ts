import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  STUDENT_COOKIE,
  STUDENT_COOKIE_MAX_AGE,
  createStudentSessionToken,
  verifyPassword,
} from '@/shared/config/auth';
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
  const { data: student } = await supabase
    .from('students')
    .select('id, password_hash')
    .eq('email', email)
    .maybeSingle();

  if (!student || !verifyPassword(parsed.password, student.password_hash)) {
    return NextResponse.json(
      { message: '이메일 또는 비밀번호가 일치하지 않습니다.' },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_COOKIE, createStudentSessionToken(student.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STUDENT_COOKIE_MAX_AGE,
  });
  return res;
}
