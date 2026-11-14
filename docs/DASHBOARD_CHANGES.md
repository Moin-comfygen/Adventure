# Dashboard UI/UX update

The dashboard follows the existing Next.js App Router, React, TypeScript, global CSS/Tailwind, Lucide, and Recharts conventions. No new runtime UI libraries or financial models were introduced.

## File summary

| Files | Changes |
| --- | --- |
| `app/page.tsx` | Connects the dashboard, invoice row/quick actions, status pills, date controls, search, notifications, collapsible navigation, mobile drawer and focus management. |
| `app/globals.css` | Design tokens, accessible text colours, 12px minimum UI type, tabular numbers, 8px-based spacing, cards, focus/hover states, responsive layouts, skeletons and reduced-motion handling. |
| `app/loading.tsx`, `components/dashboard/skeleton.tsx` | Skeletons for page loading and browser data initialization. |
| `components/dashboard/overview.tsx` | Greeting strip, period tabs, shared-data KPI cards, adventures, agents, invoice history, revenue snapshots and grouped commission balances. |
| `components/dashboard/kpi-card.tsx` | Clickable KPI cards, conditional comparison indicators and sparklines. |
| `components/dashboard/charts.tsx` | Collections bars/cumulative revenue, detailed tooltips, accessible data table, matching donut colours/percentages/highlights and empty states. |
| `components/date-range-picker.tsx` | Keyboard-accessible date-range popover, calendar and validated DD/MM/YYYY entry. |
| `components/invoice-status.tsx`, `lib/presentation.ts` | Shared unpaid/partial/paid/overdue presentation, pluralisation, initials, compact Indian money and date formatting. |
| `lib/dashboard-presentation.ts` | Presentation-only chart buckets and equivalent prior-period comparisons; source records remain unchanged. |
| `components/invoice-reminder.tsx` | Reviewable reminder draft, clipboard copy and user-initiated SMS app handoff. |
| `components/workspace/command-palette.tsx`, `components/ui/dialog.tsx` | Search dialog, keyboard navigation, native modal focus behaviour and Escape handling. |
| `eslint.config.mjs`, `package.json`, `package-lock.json` | Adds the missing lint command and development-only lint/accessibility test dependencies. |
| `lib/workbook.ts` | Changes a non-reassigned local binding from `let` to `const` to satisfy lint; import/export behaviour is unchanged. |
| `tests/presentation.test.ts`, `tests/dashboard-presentation.test.ts`, `scripts/dashboard-check.cjs` | Status/formatting/comparison tests and responsive, interaction and automated accessibility checks. |
| `README.md`, this file | Updated verification commands and implementation notes. |

## Behaviour and deliberate boundaries

- Zero collections are **Unpaid**, positive incomplete collections are **Partial**, and fully collected invoices are **Paid**. Cancelled/refunded transaction history retains its existing state. Balance due is displayed alongside outstanding statuses.
- The current invoice model has no due-date field. Overdue presentation supports a due date when available, but no dates or overdue liabilities are invented and no schema migration was added.
- Existing GST, discount, revenue, actual collection, outstanding and commission calculations are preserved. Chart and trend calculations are presentation-only. Trends are hidden for missing or zero comparison bases. Month/year comparisons use the equivalent prior elapsed period.
- Dashboard period controls filter the selected-period views. Revenue snapshots explicitly show their calendar periods; the commission summary explicitly labels its existing all-time balances.
- KPI drill-downs keep the corresponding period or outstanding filters. Collections links to the payment collection report.
- Notifications are derived from permitted unpaid/partial invoices and import errors. Read state and the sidebar preference are browser UI preferences stored separately from financial records.
- Search results respect the active role's accessible pages, permitted invoice history and agent/customer permissions.
- “Send reminder” opens a draft. No SMS/email service is configured and no message is sent automatically.
- Demo workspace and local-save labels appear only in development or when `NEXT_PUBLIC_DEMO_MODE=true`.
- The optional dark theme was not added. The requested light theme was prioritized.
- Production deployment is managed separately through Vercel at https://adventure-business-suite.vercel.app.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
# With the production server running (npm run start):
npm run test:e2e
npm run test:dashboard
```

The dashboard check captures 1440px, 1024px, 768px and 390px layouts under `/tmp/adventure-dashboard-review`, verifies no document overflow and the expected 4/2/2/1 KPI grid, checks the 12px minimum, and runs axe WCAG A/AA checks. It also exercises status presentation, keyboard invoice opening, KPI filters, search, reminders, custom-range validation and empty states, notification read state, and the mobile drawer. Automated accessibility checks supplement visual and keyboard review; they are not a complete WCAG certification.
