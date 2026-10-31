# Brightloop Billing

Subscription management and invoicing for the fictional Brightloop Software —
the system that replaces its spreadsheets and manual invoicing. Built with
Next.js (App Router), TypeScript, SQLite via Prisma, Tailwind CSS, and Zod.

- Staff app: catalog (products, plans, taxes, discounts, templates),
  subscriptions with a strict lifecycle, idempotent billing runs, invoices and
  partial payments, a dev-mail Outbox, and a reporting dashboard with CSV
  exports.
- Customer portal: sign-up, self-service (renew / pause / close per plan
  policy), invoices with a print-ready view, profile and password change.

## Setup

```bash
npm install
cp .env.example .env     # optional; defaults work for local dev
npm run setup            # prisma generate + SQLite migrate + seed (~5,000 subs)
npm run dev              # http://localhost:3000
```

Production: `npm run build && npm run start`.

Quality gates: `npm run lint` · `npm run typecheck` · `npm test`
(77 tests: password policy, transitions, pricing, billing idempotency,
discount limits/expiry, RBAC isolation, auth/reset flows, action-state).

Utilities: `npm run journey` (end-to-end lifecycle check against the seeded
database) · `npm run perf` (page-timing harness; requires a running server).

### Demo accounts

| Role     | Email                            | Password        |
| -------- | -------------------------------- | --------------- |
| Admin    | admin@brightloop.example         | Admin@12345!    |
| Staff    | staff@brightloop.example         | Staff@12345!    |
| Customer | ishita.rao@zenithworks.example   | Customer@12345! |

Additional portal customers exist in the seed; any customer can use
"Forgot password" — reset links land in the dev Outbox (readable with the
staff account), since no SMTP is configured in local development.

## Architecture

- **`src/app/(auth)`** — login, signup, forgot/reset password.
- **`src/app/(app)`** — staff application behind an ADMIN/STAFF gate.
- **`src/app/portal`** — customer portal behind a CUSTOMER gate; every
  subscription/invoice lookup re-checks ownership server-side.
- **`src/actions`** — server actions (forms); thin wrappers over services that
  return `{ ok, message, errors }` or re-render via `revalidatePath`.
- **`src/services`** — all business logic: catalog, subscriptions, billing,
  invoices, payments, discounts, taxes, reports, auth. Database writes that
  span multiple rows (invoice generation, discount usage, payment settlement)
  run inside transactions; status changes append audit rows.
- **`src/lib`** — Prisma client (libSQL driver adapter over SQLite), sessions
  (httpOnly cookie, SHA-256 token, expiry), RBAC assertions, money in integer
  paise, date/period math, Zod error mapping.
- **`prisma/schema.prisma`** — 26 models. SQLite has no native enums, so
  statuses are strings validated by Zod and TS constant unions.
- **`scripts/migrate.ts` + `scripts/ddl.ts`** — idempotent DDL applied to
  SQLite (`prisma db push` is not used; the schema file remains the source of
  truth for the Prisma client, which is generated with `engineType = "client"`
  and a driver adapter).

### Data model (core)

- `Customer` 1—n `Subscription`, `Invoice`, `Payment`; portal `User`s link via
  `User.customerId`.
- `Product` 1—n `VariantOption` (attribute + value + price extra; final unit
  price = base + extra). `Tax` is percentage-based, global (`ALL`) or scoped
  to products; applied automatically to subscription/invoice lines.
- `Plan` fixes the billing period (DAILY/WEEKLY/MONTHLY/YEARLY), minimum
  quantity, availability window, and policy flags (auto-close, early close,
  pause, renew) that are enforced in the service layer — including from the
  customer portal.
- `Subscription` flows Draft → Quotation → Confirmed → Active → Closed only;
  `SubscriptionStatusHistory` is the audit trail. Numbers are sequential
  (`SUB-000123`) from a `Counter` table.
- `Invoice` (unique number `INV-…`) carries subtotal/discount/tax/total and
  paid tracking; Draft → Confirmed → Paid, plus Cancelled. Partial `Payment`s
  settle invoices; five methods supported.
- `Discount` supports fixed/percent, min purchase/quantity, date windows, and
  a usage limit. The best eligible discount is chosen per billing period and
  its usage counter increments in the same transaction that creates the
  invoice. Uniqueness of (subscription, period start) makes billing
  idempotent.
- `OutboxEmail` is the dev mailer sink (no SMTP); staff can read what would
  have been sent.

## Performance

Seeded database: 5,000 subscriptions, ~16,000 invoices, ~13,500 payments.
Server-rendered times measured with `npm run perf` (production build):

| Page                                    | Cold  | Warm  |
| --------------------------------------- | ----- | ----- |
| `/dashboard` (aggregates + charts)      | 341ms | 133ms |
| `/subscriptions` (filters, page 2)      | 89ms  | 54ms  |
| `/invoices` (overdue filter)            | 70ms  | 32ms  |
| `/payments`                             | 71ms  | 37ms  |
| `/billing`                              | 41ms  | 32ms  |
| `/api/export/subscriptions` (CSV, all)  | 375ms | 299ms |

All pages stay far below the 2s budget. Lists paginate server-side
(25–50/page) and aggregate in SQL; `Subscription`, `Invoice`, and `Payment`
are indexed on the columns the queries filter and sort by.

## Assumptions

- Money is stored as integer paise; GST-style rates are basis points.
- Invoices are generated from the subscription's current lines each billing
  period (price changes to a plan affect future periods only — existing
  invoices are immutable records).
- Discount eligibility is evaluated at the invoice period start date; the
  single best eligible discount applies (they do not stack).
- The dev Outbox replaces SMTP. Password-reset and invoice emails are stored
  in the database and reachable in the UI instead of being delivered.
- `scripts/migrate.ts` applies hand-written SQLite DDL mirroring
  `prisma/schema.prisma` because `prisma db push`/`migrate` require the
  schema-engine binary; `prisma generate` runs with engine overrides and the
  client executes through `@prisma/adapter-libsql`.

## Known limitations

- Dev-mail only: no real SMTP integration (swap `src/lib/mail.ts` to add one).
- CSV export covers subscriptions, invoices, and payments (dashboard KPIs are
  visible on-screen rather than exported).
- Taxes are single-rate per line; multi-tax stacking is not modelled.
- Quotation approval is modelled as the customer-facing flow is out of scope;
  staff confirm quotations into subscriptions.
- Sessions are cleaned lazily (expiry is checked on use; expired rows are
  removed opportunistically).
