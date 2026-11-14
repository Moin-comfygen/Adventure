# Sales ledger and report

## Implementation

Uses the existing Next.js client application, shared CSS tokens, ExcelJS, jsPDF, Recharts and browser-local State. No dependency was added. `calculate`, `paid`, `createInvoice`, commission rates and tax formulas are unchanged.

- `components/sales/sales-ledger.tsx`: seven reconciling KPIs with help/deltas, URL filters, calendar/financial-year periods, named views, paginated sortable ledger, density, selection, ageing, reminder review queue, import history and report charts/breakdowns. Loading placeholders, empty state, operation errors and a retry boundary are included.
- `components/sales/import-sales.tsx`: three-step template/upload/review dialog, cell errors, invoice-level rejection, duplicates and error download.
- `lib/sales-ledger.ts`: shared filtering, dates, period bounds, ageing and totals.
- `lib/sales-import.ts`: named-range XLSX template with Instructions/Sales Data/Lists, CSV/XLSX validation, grouped atomic invoice import and guarded Undo.
- `lib/sales-reports.ts`: five-sheet Excel workbook, safe CSV and paginated A4 report with detailed invoice/activity/customer/tax tables. Filters and selection scope exports identically.
- `app/page.tsx`: ledger integration, Reports → Sales report, focused payment entry, A4 invoice downloads, full-refund reason capture and dashboard drill-down preservation.
- `lib/model.ts`: optional refund reason, import metadata/Undo snapshots and audit entries only. No database migration is required; older local records remain readable.
- `lib/workbook.ts`: select Sales Data when reading a multi-sheet import template, otherwise retain first-sheet behavior.
- `app/globals.css`: responsive ledger styling and desktop POS save-button height correction.
- `tests/sales-ledger.test.ts`, `tests/sales-reports.test.ts`, `scripts/sales-check.cjs`: reconciliation, dates, grouped import/Undo, report exports, accessibility, roles and 5,000-invoice coverage.
- `scripts/smoke.cjs`: existing end-to-end import fixture upgraded to the new template schema.
- `package.json`: `npm run test:sales`.

## Accounting conventions

Gross, GST and Net include active invoices only. Cancelled and refunded sales reverse recognition. Collected is original receipts on active/refunded invoices, excluding cancelled invoices. Refunded is the original paid amount on full-refund invoices. Thus:

- Gross = Net + GST.
- Outstanding = Gross − Collected + Refunded = the sum of active unpaid balances.

Original invoice amounts/payments remain visible on reversed rows. The table footer includes original document totals and explicitly labels that scope. Refunded rows show returned receipts and a recorded reason. Older refunds display “Reason not recorded”; no historical reason is invented.

The current model has full refunds only, so an old refunded invoice means all its receipts were returned. Refund dates, partial-refund transactions and bank settlement evidence are not available in the existing model.

Filters use invoice dates: collections and Payments report receipts for that invoice cohort, not unrelated invoices paid during the period. Trend collections use payment dates within the selected period for the same cohort. Agent settlements cannot be attributed to invoices: exports label period settlements and all-time pending separately. GST is aggregated from the existing per-line engine; the paise split between CGST and SGST preserves total tax. Non-taxable additional charges are shown separately in activity breakdowns.

## Import behavior

Up to 5 MB / 2,000 activity rows. Required headers use *. Data dates accept dd/mm/yyyy, Excel dates/serials and legacy ISO dates. Mobile numbers normalize +91, spaces and punctuation. Email/GSTIN, catalog names, quantities, payment bounds and shared invoice fields validate before confirmation. Unknown names offer the nearest match when sufficiently close.

An invalid activity rejects its entire invoice. Other valid invoices can be imported only after the user chooses that option. Duplicate identity is Invoice Ref first, then normalized mobile + invoice date + total, including duplicates within a file. Skip is the default. Overwrite requires edit permission and preserves the internal invoice number. Customers are reused by normalized mobile.

Imports write browser storage once after staging the full batch; a quota failure leaves the prior saved state intact. Undo is limited to the most recent batch and is blocked if invoices/customers have changed or newly created customers are used by subsequent invoices. Overwritten originals and customer records are restored. Import, Undo and export events are retained in `State.audit` and therefore included in state backups.

## Permissions and interaction

Import requires both Sales Management/create and Billing POS/create. Overwrite and Undo require Sales Management/edit. Export uses the current module's export permission; commission fields use Agents & Commissions/view. Receptionists see their permitted history only. Reminders use the existing invoice reminder composer: users review and explicitly share each message; there is no automatic messaging backend.

URL filters use the `sales_` prefix. Page size (25/50/100) and density persist separately. At 768px and below, extended filters move to a native modal drawer; the ledger scrolls within its own container. Rows support Enter/Space, `/` focuses search, native dialogs support Escape, and focus rings remain visible.

## Validation and limits

Unit/integration coverage includes the template's own multi-activity sample, invalid groups, duplicate skip/overwrite, Undo safeguards, workbook round-trip, tax reconciliation, CSV injection protection, PDF pagination and restricted commission fields. Browser checks cover 1440/1024/768/390px, axe accessibility, pagination/preferences, upload/Undo, exports and a 5,000-record fixture. Existing import/payout/invoice PDF/printing regression checks are retained.

This remains a browser-local prototype. Data, audit history and Undo are not shared across devices; available localStorage capacity limits total stored invoice/image/import history size. Reports faithfully export available records; no historical refund reasons or separate refund timestamps are fabricated. No external messages are sent automatically. The reminder queue opens the existing individual composer.

Final verification: build, typecheck, lint and all 44 unit/integration tests pass. Ledger and Sales report browser checks pass at 1440, 1024, 768 and 390px with no page overflow or WCAG A/AA axe violations. A 5,000-invoice browser fixture renders 25 rows; measured load was 848 ms and search 75 ms. Template upload/confirmation/Undo, workbook export and role restrictions pass. Existing POS keyboard/payment checks, image upload/print checks and import/payout/PDF/printing smoke checks pass.
