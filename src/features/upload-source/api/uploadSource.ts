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
  author?: string | null;
  edition?: string | null;
  isbn?: string | null;
  units?: string[];
  tags?: string[];
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
  if (input.author) fd.append('author', input.author);
  if (input.edition) fd.append('edition', input.edition);
  if (input.isbn) fd.append('isbn', input.isbn);
  if (input.units && input.units.length) fd.append('units', input.units.join(','));
  if (input.tags && input.tags.length) fd.append('tags', input.tags.join(','));
  const { data } = await api.post<{ id: string }>('/agent/sources', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
  });
  return data;
}
