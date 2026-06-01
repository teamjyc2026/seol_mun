export const SOURCE_TYPES = [
  '교과서',
  '문제집',
  '기출',
  '요약본',
  '강의자료',
  '기타',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'] as const;
export type Grade = (typeof GRADES)[number];

export type IndexingStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'needs_ocr';

export type Source = {
  id: string;
  created_at: string;
  title: string;
  source_type: SourceType;
  subject: string;
  subjects: string[];
  grade: Grade | null;
  publisher: string | null;
  year: number | null;
  description: string | null;
  author: string | null;
  edition: string | null;
  isbn: string | null;
  language: string | null;
  units: string[];
  tags: string[];
  file_path: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  total_pages: number | null;
  chunk_count: number;
  text_density: number | null;
  needs_ocr: boolean;
  indexing_status: IndexingStatus;
  indexing_error: string | null;
  indexed_at: string | null;
  created_by: string | null;
  /** resolved uploader nickname for created_by (uuid), attached at fetch time */
  author_nickname?: string | null;
};

export type SourceChunk = {
  id: string;
  source_id: string;
  page_number: number | null;
  chunk_index: number;
  content: string;
  chapter_path: string[];
  similarity?: number;
};

export type SourceMetadataPatch = Partial<{
  title: string;
  source_type: SourceType;
  subject: string;
  subjects: string[];
  grade: Grade | null;
  publisher: string | null;
  year: number | null;
  description: string | null;
  author: string | null;
  edition: string | null;
  isbn: string | null;
  units: string[];
  tags: string[];
}>;
