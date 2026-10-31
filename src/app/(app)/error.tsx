'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded border border-red-200 bg-red-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-red-800">Something went wrong</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-red-700">
        The page could not be loaded. Try again, or return to the dashboard.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={reset}>
          Try again
        </Button>
        <a
          href="/dashboard"
          className="inline-flex h-7 items-center rounded border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
