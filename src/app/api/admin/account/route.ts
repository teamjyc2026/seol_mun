import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getSessionUserId,
  hashPassword,
  verifyPassword,
} from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';

export async function GET() {
  const id = await getSessionUserId();
  if (!id) return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('admin_users')
    .select('email, nickname')
    .eq('id', id)
    .maybeSingle();
  if (!data) return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  return NextResponse.json(data);
}

const patchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(40).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(6).optional(),
  })
  .refine((v) => v.nickname !== undefined || v.newPassword !== undefined, {
    message: '변경할 내용이 없습니다.',
  });

export async function PATCH(req: NextRequest) {
  const id = await getSessionUserId();
  if (!id) return NextResponse.json({ message: 'unauthorized' }, { status: 401 });

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: '입력값을 확인해 주세요.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const update: { nickname?: string; password_hash?: string } = {};

  if (parsed.nickname !== undefined) update.nickname = parsed.nickname.trim();

  if (parsed.newPassword !== undefined) {
    const { data: user } = await supabase
      .from('admin_users')
      .select('password_hash')
      .eq('id', id)
      .maybeSingle();
    if (
      !user ||
      !parsed.currentPassword ||
      !verifyPassword(parsed.currentPassword, user.password_hash)
    ) {
      return NextResponse.json(
        { message: '현재 비밀번호가 일치하지 않습니다.' },
        { status: 403 },
      );
    }
    update.password_hash = hashPassword(parsed.newPassword);
  }

  const { data, error } = await supabase
    .from('admin_users')
    .update(update)
    .eq('id', id)
    .select('email, nickname')
    .single();
  if (error || !data) {
    return NextResponse.json({ message: '변경 중 오류가 발생했어요.' }, { status: 500 });
  }
  return NextResponse.json(data);
}
