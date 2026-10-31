'use client';

import { Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cancelInvoiceAction, confirmInvoiceAction, sendInvoiceAction } from '@/actions/invoices';
import { ActionButton } from '@/components/ui/action-button';

export function InvoiceActions({ invoiceId, status }: { invoiceId: string; status: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'DRAFT' ? (
        <ActionButton label="Confirm invoice" variant="primary" action={() => confirmInvoiceAction(invoiceId)} />
      ) : null}
      {status === 'CONFIRMED' ? (
        <ActionButton
          label="Send invoice"
          variant="primary"
          action={async () => {
            await sendInvoiceAction(invoiceId);
            router.refresh();
          }}
        />
      ) : null}
      <a
        href={`/print/invoices/${invoiceId}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <Printer className="h-3.5 w-3.5" /> Print
      </a>
      {status === 'DRAFT' || status === 'CONFIRMED' ? (
        <ActionButton
          label="Cancel invoice"
          variant="danger"
          requireConfirm
          confirmMessage="Cancel this invoice? It will no longer accept payments."
          action={() => cancelInvoiceAction(invoiceId)}
        />
      ) : null}
    </div>
  );
}
