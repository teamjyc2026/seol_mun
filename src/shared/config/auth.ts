import 'server-only';
import { cookies } from 'next/headers';
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_VALUE,
  ADMIN_PASSWORD,
} from './admin';
import { getSupabaseServer } from './supabase-server';

/**
 * Two completely separate auth realms:
 *  - Admin (설문 대시보드): shared password `aitutor!`, cookie `seolmun_admin=ok`.
 *  - Uploader (문제 올리는 사람): email account, cookie `seolmun_uploader=<token>`.
 */

export const UPLOADER_COOKIE = 'seolmun_uploader';
export const UPLOADER_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14d

/** Master invite code required to register an uploader account. */
export const INVITE_CODE = ADMIN_PASSWORD;

const SESSION_SECRET = process.env.SESSION_SECRET ?? ADMIN_PASSWORD;

export type Uploader = { id: string; email: string; nickname: string };

// ---- admin (shared password) realm ---------------------------------------

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

// ---- password hashing (scrypt, no external deps) -------------------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---- uploader session token (HMAC-signed user id) ------------------------

function sign(payload: string): string {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(userId, 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

// ---- uploader (email account) realm --------------------------------------

export async function getUploaderId(): Promise<string | null> {
  const store = await cookies();
  return verifySessionToken(store.get(UPLOADER_COOKIE)?.value);
}

export async function getUploader(): Promise<Uploader | null> {
  const id = await getUploaderId();
  if (!id) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('admin_users')
    .select('id, email, nickname')
    .eq('id', id)
    .maybeSingle();
  return (data as Uploader | null) ?? null;
}

/** Boolean gate for API routes in the problem/agent area. */
export async function requireUploader(): Promise<boolean> {
  return (await getUploaderId()) !== null;
}
