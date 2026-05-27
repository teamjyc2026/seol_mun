import { api } from '@/shared/api/axios';
import type { SourceType, Grade } from '@/entities/source';

export type UploadSourceInput = {
  file: File;
  title: string;
  source_type: SourceType;
  subject?: string;
  grade?: Grade | null;
  publisher?: string | null;
  year?: number | null;
  description?: string | null;
};

export async function uploadSource(input: UploadSourceInput): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append('file', input.file);
  fd.append('title', input.title);
  fd.append('source_type', input.source_type);
  if (input.subject) fd.append('subject', input.subject);
  if (input.grade) fd.append('grade', input.grade);
  if (input.publisher) fd.append('publisher', input.publisher);
  if (input.year != null) fd.append('year', String(input.year));
  if (input.description) fd.append('description', input.description);
  const { data } = await api.post<{ id: string }>('/agent/sources', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
  });
  return data;
}
