import { formatMoney } from '@/lib/money';

/** Right-aligned currency value with tabular numerals. */
export function Money({ minor, muted, className = '' }: { minor: number; muted?: boolean; className?: string }) {
  return (
    <span className={`tabular-nums whitespace-nowrap ${muted ? 'text-zinc-500' : ''} ${className}`}>
      {formatMoney(minor)}
    </span>
  );
}
