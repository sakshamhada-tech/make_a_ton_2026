export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-1" role="status" aria-label="Loading">
      <div className="border-b border-zinc-100 px-3 py-2.5">
        <Skeleton className="h-3 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-zinc-100 px-3 py-2.5 last:border-b-0">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-28' : c === cols - 1 ? 'ml-auto w-20' : 'w-24'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="grid gap-px overflow-hidden rounded border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white px-4 py-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-28" />
        </div>
      ))}
    </div>
  );
}
