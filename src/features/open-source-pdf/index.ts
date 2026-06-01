import { toast } from 'sonner';
import { api } from '@/shared/api/axios';

/**
 * Open a source PDF (from the storage bucket) in a new tab, jumping to the
 * cited page via the `#page=N` fragment that browser PDF viewers honor.
 */
export async function openSourcePdf(sourceId: string, page?: number | null): Promise<void> {
  try {
    const { data } = await api.get<{ url: string }>(
      `/agent/sources/${sourceId}/signed-url`,
    );
    const url = page ? `${data.url}#page=${page}` : data.url;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    toast.error(
      String((e as { message?: string })?.message ?? '출처 파일을 열지 못했어요.'),
    );
  }
}
