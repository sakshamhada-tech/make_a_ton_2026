import { TableSkeleton, MetricSkeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-5">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-zinc-200" />
      </div>
      <MetricSkeleton />
      <div className="mt-6">
        <TableSkeleton />
      </div>
    </div>
  );
}
