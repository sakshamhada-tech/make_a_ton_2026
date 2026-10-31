import { formatMoney } from '@/lib/money';

export interface PlanDatum {
  planName: string;
  period: string;
  count: number;
  mrrMinor: number;
}

/** Compact list-style bar chart for MRR contribution by plan. */
export function PlanBars({ data }: { data: PlanDatum[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-zinc-500">No active subscriptions.</p>;
  }
  const max = Math.max(...data.map((d) => d.mrrMinor), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.planName}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-zinc-800">{d.planName}</span>
            <span className="tabular-nums whitespace-nowrap text-zinc-600">{formatMoney(d.mrrMinor)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${(d.mrrMinor / max) * 100}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-2xs text-zinc-500">
              {d.count} subs
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
