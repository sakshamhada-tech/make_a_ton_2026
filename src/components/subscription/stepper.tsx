import { Check } from 'lucide-react';
import type { SubscriptionStatus } from '@/lib/enums';
import { SUBSCRIPTION_STATUS_LABELS } from '@/lib/enums';

const ORDER: SubscriptionStatus[] = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];

/**
 * Visual status stepper for the strict forward flow
 * Draft -> Quotation -> Confirmed -> Active -> Closed.
 */
export function SubscriptionStepper({ status, paused }: { status: SubscriptionStatus; paused?: boolean }) {
  const currentIndex = ORDER.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Subscription status">
      {ORDER.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step} className="flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-2xs font-medium ${
                current
                  ? 'bg-accent-subtle text-accent-text'
                  : done
                    ? 'text-zinc-600'
                    : 'text-zinc-400'
              }`}
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-2xs ${
                  current
                    ? 'border-accent bg-accent text-white'
                    : done
                      ? 'border-zinc-300 bg-zinc-100 text-zinc-500'
                      : 'border-zinc-200 bg-white text-zinc-300'
                }`}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              {SUBSCRIPTION_STATUS_LABELS[step]}
            </span>
            {i < ORDER.length - 1 ? <span className="mx-1 h-px w-4 bg-zinc-200" aria-hidden="true" /> : null}
          </li>
        );
      })}
      {paused ? (
        <li className="ml-1">
          <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-2xs font-medium text-amber-800">
            Paused
          </span>
        </li>
      ) : null}
    </ol>
  );
}
