import type { ReactNode } from 'react';

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded border border-zinc-200 bg-white ${className}`}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-2xs uppercase tracking-wide text-zinc-500">
        {children}
      </tr>
    </thead>
  );
}

export function TH({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-semibold whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 align-middle ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      {children}
    </td>
  );
}

export function TR({ children, href }: { children: ReactNode; href?: string }) {
  return (
    <tr
      className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70"
      {...(href ? { 'data-href': href } : {})}
    >
      {children}
    </tr>
  );
}
