import axios from 'axios';
import { api } from '@/shared/api/axios';
import type { SourceType, Grade } from '@/entities/source';
import type { Subject } from '@/shared/config/subjects';

export type UploadSourceInput = {
  file: File;
  title: string;
  source_type: SourceType;
  /** Primary subject (kept for back-compat). */
  subject?: Subject;
  /** All applicable subjects. A single passage may belong to several. */
  subjects?: Subject[];
  grade?: Grade | null;
  publisher?: string | null;
  year?: number | null;
  description?: string | null;
  author?: string | null;
  edition?: string | null;
  isbn?: string | null;
  units?: string[];
  tags?: string[];
};

/**
 * Uploads the PDF straight to Supabase Storage (via a server-issued signed URL)
 * and then registers metadata with the API. The file never passes through the
 * Vercel Function, sidestepping its 4.5MB request-body limit (which surfaced as
 * a 413 for large textbook PDFs).
 */
export async function uploadSource(
  input: UploadSourceInput,
  onProgress?: (pct: number) => void,
): Promise<{ id: string }> {
  // 1) Ask the server for a signed upload URL.
  const { data: signed } = await api.post<{
    id: string;
    path: string;
    signedUrl: string;
    token: string;
  }>('/agent/sources/upload-url', {
    filename: input.file.name,
    size: input.file.size,
  });

  // 2) Upload the bytes directly to Supabase Storage (not through /api).
  await axios.put(signed.signedUrl, input.file, {
    headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    timeout: 600_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  onProgress?.(100);

  // 3) Register the source row (small JSON) — server indexes it.
  const subjects = input.subjects && input.subjects.length
    ? input.subjects
    : input.subject
      ? [input.subject]
      : [];
  const { data } = await api.post<{ id: string }>(
    '/agent/sources',
    {
      path: signed.path,
      original_filename: input.file.name,
      file_size_bytes: input.file.size,
      title: input.title,
      source_type: input.source_type,
      subject: subjects[0],
      subjects: subjects.length ? subjects : undefined,
      grade: input.grade ?? undefined,
      publisher: input.publisher ?? undefined,
      year: input.year ?? undefined,
      description: input.description ?? undefined,
      author: input.author ?? undefined,
      edition: input.edition ?? undefined,
      isbn: input.isbn ?? undefined,
      units: input.units && input.units.length ? input.units : undefined,
      tags: input.tags && input.tags.length ? input.tags : undefined,
    },
    { timeout: 300_000 },
  );
  return data;
}
