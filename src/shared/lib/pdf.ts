import 'server-only';

export type PdfPage = { page: number; text: string };

export type OutlineEntry = {
  title: string;
  /** ancestors + self, e.g. ['Ⅰ. 전근대', '2. 조선'] */
  path: string[];
  startPage: number;
  /** inclusive */
  endPage: number;
};

export type PdfExtractResult = {
  pages: PdfPage[];
  totalPages: number;
  outline: OutlineEntry[];
};

type OutlineNode = {
  title: string;
  dest?: string | Array<unknown> | null;
  items?: OutlineNode[];
};

async function resolvePage(
  doc: {
    getDestination: (n: string) => Promise<unknown>;
    getPageIndex: (ref: unknown) => Promise<number>;
  },
  dest: OutlineNode['dest'],
): Promise<number | null> {
  if (!dest) return null;
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    if (!explicit || !Array.isArray(explicit)) return null;
    const ref = explicit[0];
    if (ref == null) return null;
    const idx = await doc.getPageIndex(ref);
    return idx + 1;
  } catch {
    return null;
  }
}

async function flattenOutline(
  doc: {
    getDestination: (n: string) => Promise<unknown>;
    getPageIndex: (ref: unknown) => Promise<number>;
  },
  nodes: OutlineNode[] | null | undefined,
  ancestors: string[],
  out: { title: string; path: string[]; startPage: number }[],
): Promise<void> {
  if (!nodes) return;
  for (const n of nodes) {
    const title = (n.title ?? '').trim();
    const path = title ? [...ancestors, title] : ancestors;
    const page = await resolvePage(doc, n.dest);
    if (title && page != null) {
      out.push({ title, path, startPage: page });
    }
    if (n.items?.length) {
      await flattenOutline(doc, n.items, path, out);
    }
  }
}

/**
 * Extract per-page text + outline. The outline is normalized into
 * non-overlapping page ranges sorted by startPage, with endPage filled in
 * from the next entry (or totalPages for the last one).
 */
export async function extractTextWithPages(buf: Buffer): Promise<PdfExtractResult> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const u8 = new Uint8Array(buf);
  const pdf = await getDocumentProxy(u8);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pieces: string[] = Array.isArray(text) ? text : [text];
  const pages: PdfPage[] = pieces.map((t, i) => ({
    page: i + 1,
    text: (t ?? '').trim(),
  }));

  let outline: OutlineEntry[] = [];
  try {
    const raw = await (
      pdf as unknown as { getOutline: () => Promise<OutlineNode[] | null> }
    ).getOutline();
    const flat: { title: string; path: string[]; startPage: number }[] = [];
    await flattenOutline(pdf as never, raw, [], flat);
    flat.sort((a, b) => a.startPage - b.startPage);
    outline = flat.map((e, i) => ({
      title: e.title,
      path: e.path,
      startPage: e.startPage,
      endPage:
        i + 1 < flat.length
          ? Math.max(e.startPage, flat[i + 1].startPage - 1)
          : totalPages,
    }));
  } catch {
    outline = [];
  }

  return { pages, totalPages, outline };
}

const HEURISTIC_PATTERNS = [
  /^(제\s*\d+\s*[장부편])\s*[.:·\-]?\s*(.+)$/,
  /^([IVXⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)\s*[.:·\-]\s*(.+)$/,
  /^(\d+)\s*[.:·\-]\s*(.+)$/,
  /^([■▣◆●▶])\s*(.+)$/,
];

/**
 * Fallback when the PDF has no usable outline.
 * Look at the first non-empty line of each page; if it matches a chapter-
 * heading pattern, treat that as the chapter for this page; carry forward
 * the most recent match to subsequent pages.
 */
export function detectChaptersByHeuristic(pages: PdfPage[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  let current: string[] = [];
  for (const p of pages) {
    const firstLine = (p.text.split('\n').find((l) => l.trim().length > 0) ?? '').trim();
    for (const re of HEURISTIC_PATTERNS) {
      const m = firstLine.match(re);
      if (m) {
        const label = `${m[1].trim()} ${m[2].trim()}`.trim();
        current = [label];
        break;
      }
    }
    if (current.length) out.set(p.page, current.slice());
  }
  return out;
}

export function chapterPathForPage(
  page: number,
  outline: OutlineEntry[],
  heuristic: Map<number, string[]>,
): string[] {
  if (outline.length > 0) {
    let best: OutlineEntry | null = null;
    for (const e of outline) {
      if (page >= e.startPage && page <= e.endPage) {
        if (!best || e.path.length >= best.path.length) best = e;
      }
    }
    if (best) return best.path;
  }
  return heuristic.get(page) ?? [];
}
