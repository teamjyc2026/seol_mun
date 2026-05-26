'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatAnswer, parts, questions } from '@/entities/survey';
import { giftLabel, type ResponseRow as Row } from '@/entities/response';
import { DeleteButton } from '@/features/admin-delete-response';

function fmtDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ResponseRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-mx-2 -my-1 flex flex-1 items-center gap-3 rounded-md px-2 py-1 text-left transition hover:bg-zinc-50"
        >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-zinc-900">
              {row.name ?? '—'}
            </span>
            <span className="text-xs text-zinc-500">{row.affiliation ?? '—'}</span>
            <span
              className={cn(
                'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                row.status === 'submitted'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700',
              )}
            >
              {row.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            <span>{fmtDate(row.created_at)}</span>
            <span>{row.email ?? '—'}</span>
            <span>{row.phone ?? '—'}</span>
            {row.gift ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                <Gift className="h-3 w-3" />
                {giftLabel[row.gift]}
              </span>
            ) : null}
          </div>
        </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </button>
        <DeleteButton id={row.id} />
      </div>

      {open ? (
        <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/40 px-4 py-4">
          {parts
            .filter((p) => p.id !== 'CONSENT')
            .map((part) => (
              <section key={part.id}>
                <h4 className={cn('mb-2 text-xs font-semibold', part.theme.accentText)}>
                  {part.title}
                </h4>
                <dl className="space-y-2">
                  {part.questionIds.map((qid) => {
                    const q = questions[qid];
                    const v = row.answers?.[qid];
                    return (
                      <div
                        key={qid}
                        className="grid grid-cols-[60px_1fr] gap-3 text-sm"
                      >
                        <dt className="font-mono text-xs text-zinc-400">{qid}</dt>
                        <dd className="min-w-0">
                          <p className="text-xs text-zinc-500">{q?.title}</p>
                          <p className="whitespace-pre-wrap break-words text-zinc-800">
                            {formatAnswer(qid, v)}
                          </p>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}
          <div className="border-t border-zinc-200 pt-3 font-mono text-[10px] text-zinc-400">
            id · {row.id}
          </div>
        </div>
      ) : null}
    </li>
  );
}
