import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-teal-700 text-sm font-bold text-white">
            B
          </span>
          <span className="text-sm font-semibold text-zinc-900">Brightloop Billing</span>
        </Link>
        <div className="rounded border border-zinc-200 bg-white px-6 py-6 shadow-sm">
          <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-xs text-zinc-600">{footer}</div> : null}
      </div>
    </div>
  );
}
