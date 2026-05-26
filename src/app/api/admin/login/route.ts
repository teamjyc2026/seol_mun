import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_VALUE,
  ADMIN_PASSWORD,
} from '@/shared/config/admin';

export const runtime = 'nodejs';

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (parsed.password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { message: '비밀번호가 일치하지 않습니다.' },
      { status: 401 },
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
}
