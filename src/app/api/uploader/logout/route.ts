import { NextResponse } from 'next/server';
import { UPLOADER_COOKIE } from '@/shared/config/auth';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(UPLOADER_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
