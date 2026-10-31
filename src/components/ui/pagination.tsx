import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function pageHref(basePath: string, query: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  params.set('page', String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  meta,
  basePath,
  query,
}: {
  meta: PageMeta;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <nav className="flex items-center justify-between gap-4 text-xs text-zinc-600" aria-label="Pagination">
      <p>
        Showing <span className="font-medium text-zinc-900">{from}</span>–<span className="font-medium text-zinc-900">{to}</span> of{' '}
        <span className="font-medium text-zinc-900">{meta.total}</span>
      </p>
      <div className="flex items-center gap-1">
        {meta.hasPrev ? (
          <Link
            href={pageHref(basePath, query, meta.page - 1)}
            className="inline-flex h-7 items-center gap-1 rounded border border-zinc-300 bg-white px-2 hover:bg-zinc-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Link>
        ) : (
          <span className="inline-flex h-7 items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 text-zinc-400">
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </span>
        )}
        <span className="px-2 text-zinc-500">
          Page {meta.page} of {meta.totalPages}
        </span>
        {meta.hasNext ? (
          <Link
            href={pageHref(basePath, query, meta.page + 1)}
            className="inline-flex h-7 items-center gap-1 rounded border border-zinc-300 bg-white px-2 hover:bg-zinc-50"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="inline-flex h-7 items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 text-zinc-400">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}
