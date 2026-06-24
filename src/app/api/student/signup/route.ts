import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  STUDENT_COOKIE,
  STUDENT_COOKIE_MAX_AGE,
  createStudentSessionToken,
  hashPassword,
} from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';

const schema = z.object({
  // 모바일 키보드가 넣는 공백·대문자를 검증 전에 정규화 — 안 그러면 email()이 실패.
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1).max(40),
  grade: z.string().trim().max(10).optional(),
  school: z.string().trim().max(60).optional(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch (e) {
    // 어느 칸이 문제인지 정확히 알려준다 (예전엔 항상 "비밀번호 6자"라 오해를 샀음).
    const field = e instanceof z.ZodError ? e.issues[0]?.path[0] : null;
    const message =
      field === 'email'
        ? '이메일 형식이 올바르지 않아요. (예: name@example.com)'
        : field === 'password'
          ? '비밀번호는 6자 이상이어야 해요.'
          : field === 'name'
            ? '이름을 입력해 주세요.'
            : '입력값을 확인해 주세요.';
    return NextResponse.json({ message }, { status: 400 });
  }

  const email = parsed.email; // 이미 trim·소문자 처리됨
  const supabase = getSupabaseServer();

  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ message: '이미 가입된 이메일입니다.' }, { status: 409 });
  }

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      email,
      password_hash: hashPassword(parsed.password),
      name: parsed.name.trim(),
      grade: parsed.grade?.trim() || null,
      school: parsed.school?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !student) {
    return NextResponse.json({ message: '가입 처리 중 오류가 발생했어요.' }, { status: 500 });
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
