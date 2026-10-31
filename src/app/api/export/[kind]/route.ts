import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { errorResponse, str, type SearchParams } from '@/lib/http';
import { parseDateInput } from '@/lib/dates';
import { exportInvoicesCsv, exportPaymentsCsv, exportSubscriptionsCsv } from '@/services/report.service';

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

function download(name: string, csv: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}

function filtersFrom(searchParams: SearchParams) {
  return {
    q: str(searchParams, 'q'),
    status: str(searchParams, 'status'),
    customerId: str(searchParams, 'customerId'),
    planId: str(searchParams, 'planId'),
    from: parseDateInput(str(searchParams, 'from') ?? ''),
    to: parseDateInput(str(searchParams, 'to') ?? ''),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { kind } = await params;
    const { searchParams } = new URL(request.url);
    const filters = filtersFrom(searchParams as unknown as SearchParams);
    if (kind === 'subscriptions') {
      return download('subscriptions.csv', toCsv(await exportSubscriptionsCsv(user, filters)));
    }
    if (kind === 'payments') {
      return download('payments.csv', toCsv(await exportPaymentsCsv(user, filters)));
    }
    return download('invoices.csv', toCsv(await exportInvoicesCsv(user, filters)));
  } catch (error) {
    return errorResponse(error);
  }
}
