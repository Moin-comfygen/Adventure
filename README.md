# Adventure Business Suite

Interactive adventure tourism billing and sales prototype developed for Comfygen Technologies. Built with Next.js, React, TypeScript, Tailwind, Radix/shadcn-style components, Lucide, Recharts, React Hook Form, Zod, dnd-kit, ExcelJS, and jsPDF.

## Run

Requires Node.js 22 or newer (validated with Node.js 24).

```sh
cd /workspace/Adventure
npm ci --cache /tmp/adventure-npm
npm run dev
```

The development server uses port 3000. Use the existing checkout; a separate Git worktree is unnecessary. Select a demo role on the welcome screen. No external services, API keys, or real payment credentials are needed.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm run test:e2e` exercises the running app using headless Chromium. Set `BASE_URL` to override the default server URL and `CHROMIUM_PATH` to override `/usr/bin/chromium`. It uses a new browser context, generates artifacts under `/tmp`, and does not modify your regular browser data. Browser print tests verify the invocation and print layouts, not physical printer hardware.

## Working workflows

- Billing: customer reuse, multiple services, per-service configurable GST, proportionally allocated discounts, additional charges, intra/interstate tax, agent referral, split and partial payments.
- Invoices: unique numbering, saved history, A4 and 58/80 mm receipt previews, template-aware PDF export and browser printing, balance collection, cancellation and full refund.
- Partners: create/edit agents, percentage or fixed commission, immutable invoice commission snapshots, ledger, partial settlements, adjustments, exports.
- Sales: search, date filters, Excel export, XLSX/CSV imports with column mapping, preview, row validation, stable external IDs, duplicate prevention, and import history.
- Dashboard and reports: shared transaction data, net revenue, collections by payment date, outstanding balances, activity mix, partner performance, daily/monthly/yearly and operational exports.
- Designer: sortable canvas sections, editable display labels, styling, width/spacing, protected required sections, column ordering, uploaded logo/signature/payment QR, undo/redo, saved templates and default selection.
- Customers: auto-created records, reuse, booking history and spending.
- Permissions: exactly three demo roles; configurable Manager action matrix; fixed Receptionist restrictions; operation checks and permitted history filtering.

## Financial rules

Amounts are rounded to two decimal places. Discounts apply proportionally to service lines before each configured GST rate. Additional charges are explicitly **non-taxable** in this prototype. Invoiced revenue is discounted service amount plus additional charges, excluding GST. Actual collections use payment dates. Customer outstanding is invoice total less payments.

Percentage commission uses discounted services only, excluding GST and additional charges. Fixed commission is per invoice. Rate, type and amount are captured at finalization. Changing agent or service configuration does not recalculate historical invoices.

Full cancellation/refund excludes an invoice from active sales and reverses its full commission liability while preserving the invoice and payment snapshots. Existing payouts remain in the ledger; a negative agent outstanding balance indicates recovery due. This is an operational full-reversal model, not a payment processor refund or statutory credit-note system. Partial line refunds are not supported.

## Data and boundaries

The seed contains 100 customers, 75 invoices, 12 agents and 10 activities, with mixed GST, historical bookings, partial payments and commission settlements. Data persists in browser localStorage. Settings provides a complete JSON backup download. Uploaded images should be under 1 MB; large image collections can exhaust browser storage. Import batches are limited to 1,000 rows. Prices and GST for imports come from the current service catalog; imported sales use the same transaction function as manual bills.

This is a local, single-device prototype. Demo role switching and browser-side operation checks are **not production authentication or a server-side security boundary**. Production requires a backend database, authenticated sessions, enforced server-side authorization, multi-user concurrency, audit records, and validated invoicing/tax requirements. Demo GST rates, business GSTIN and contacts are illustrative. Validate tax reports before statutory use.

The official Comfygen logo was not supplied; no replacement Comfygen logo was created. The invoice designer supports authorized business asset uploads. Digital waivers and document scanning are extension types only and intentionally have no current workflow.

## Validation

- 18 unit/integration tests cover financial calculations, mixed GST, commission, cancellation, role checks, import identifiers, CSV parsing, XLSX round trips and collection date attribution.
- Browser smoke suites cover bill creation, refresh persistence, role restrictions, import preview/validation, automatic commission, partial payout, canvas drag-and-drop, template persistence, A4/thermal PDF downloads and print actions, and mobile overflow.
- Production compilation and TypeScript checks are included in the build workflow.

## Dashboard UI update

See [Dashboard changes](docs/DASHBOARD_CHANGES.md) for the file summary, interaction behaviour and boundaries. With the production server running (`npm run start`), `npm run test:dashboard` checks the requested four viewport sizes, keyboard flows, invoice presentation and automated WCAG A/AA rules. Artifacts are written under `/tmp/adventure-dashboard-review`. Production hides demo labels unless `NEXT_PUBLIC_DEMO_MODE=true`.
