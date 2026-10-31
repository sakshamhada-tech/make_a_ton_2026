// All money values are integer minor units (paise). Never use floats for money.

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'INR';
const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? 'en-IN';

const formatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Format minor units as currency, e.g. 123456 -> "₹1,234.56". */
export function formatMoney(minor: number): string {
  return formatter.format(minor / 100);
}

/** Compact currency for dashboard metrics, e.g. "₹1.2L". */
export function formatMoneyCompact(minor: number): string {
  return compactFormatter.format(minor / 100);
}

/** Whole-rupee amount without decimals, e.g. 123456 -> "1,235". */
export function formatMoneyWhole(minor: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(Math.round(minor / 100));
}

/** Convert a decimal string ("18.5") to basis points (1850). */
export function bpsFromDecimalString(input: string): number {
  const trimmed = input.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid percentage: ${input}`);
  }
  const whole = Number.parseInt(match[1], 10);
  const frac = match[2] ? Number.parseInt(match[2].padEnd(2, '0'), 10) : 0;
  return whole * 100 + frac;
}

/** Format basis points as a percentage string, e.g. 1850 -> "18.5%". */
export function formatBps(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}

/** Parse a rupee input string ("1,234.56" or "1234.5") into minor units. */
export function moneyFromInput(input: string): number {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid amount: ${input}`);
  }
  const [whole, frac = ''] = cleaned.split('.');
  const minor = Number.parseInt(whole, 10) * 100 + Number.parseInt(frac.padEnd(2, '0'), 10);
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Amount out of range: ${input}`);
  }
  return minor;
}
