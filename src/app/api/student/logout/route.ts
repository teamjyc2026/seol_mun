import { NextResponse } from 'next/server';
import { STUDENT_COOKIE } from '@/shared/config/auth';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
