import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';

/** Column header link that toggles sorting via searchParams. */
export function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  basePath,
  query,
  align = 'left',
}: {
  label: string;
  field: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  basePath: string;
  query: Record<string, string | undefined>;
  align?: 'left' | 'right';
}) {
  const nextDir = currentSort === field && currentDir === 'asc' ? 'desc' : 'asc';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  params.set('sort', field);
  params.set('dir', nextDir);
  const active = currentSort === field;
  const Icon = active && currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Link
      href={`${basePath}?${params.toString()}`}
      className={`inline-flex items-center gap-1 hover:text-zinc-900 ${active ? 'text-zinc-900' : ''} ${
        align === 'right' ? 'flex-row-reverse' : ''
      }`}
    >
      {label}
      <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
    </Link>
  );
}
