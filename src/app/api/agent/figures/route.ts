import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'problem-figures';

const schema = z.object({
  /** 데이터URL 헤더 제외 base64. */
  image: z.string().min(1).max(8_000_000),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** 문제 그림/도표 업로드 — base64 이미지를 public 버킷에 올리고 URL 반환. */
export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'invalid body' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const path = `${crypto.randomUUID()}.${EXT[body.mediaType]}`;
  const bytes = Buffer.from(body.image, 'base64');
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: body.mediaType,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
