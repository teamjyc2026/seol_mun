import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUploader } from '@/shared/config/auth';
import { getSupabaseServer } from '@/shared/config/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  filename: z.string().min(1).max(300),
  size: z.coerce.number().int().min(1).max(50 * 1024 * 1024),
});

/**
 * Issues a signed upload URL so the browser uploads the PDF straight to
 * Supabase Storage, bypassing the 4.5MB Vercel Function request-body limit.
 * Returns the storage path + a fully-signed URL the client PUTs the file to.
 */
export async function POST(req: NextRequest) {
  if (!(await requireUploader())) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!parsed.data.filename.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ message: 'PDF만 업로드 가능합니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const id = crypto.randomUUID();
  const path = `${id}.pdf`;

  const { data, error } = await supabase.storage
    .from('sources')
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { message: '업로드 URL 발급 실패', details: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id, path, signedUrl: data.signedUrl, token: data.token });
}
