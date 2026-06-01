import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  INVITE_CODE,
  UPLOADER_COOKIE,
  UPLOADER_COOKIE_MAX_AGE,
  createSessionToken,
  hashPassword,
} from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().trim().min(1).max(40),
  inviteCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { message: '입력값을 확인해 주세요. (비밀번호는 6자 이상)' },
      { status: 400 },
    );
  }

  if (parsed.inviteCode !== INVITE_CODE) {
    return NextResponse.json({ message: '초대코드가 올바르지 않습니다.' }, { status: 403 });
  }

  const email = parsed.email.trim().toLowerCase();
  const supabase = getSupabaseServer();

  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ message: '이미 가입된 이메일입니다.' }, { status: 409 });
  }

  const { data: user, error } = await supabase
    .from('admin_users')
    .insert({
      email,
      password_hash: hashPassword(parsed.password),
      nickname: parsed.nickname.trim(),
    })
    .select('id')
    .single();

  if (error || !user) {
    return NextResponse.json({ message: '가입 처리 중 오류가 발생했어요.' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(UPLOADER_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UPLOADER_COOKIE_MAX_AGE,
  });
  return res;
}
