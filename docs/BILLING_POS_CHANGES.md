# Billing POS UI and workflow update

The Billing POS follows the existing Next.js/React/TypeScript, global CSS, React Hook Form, Zod, Lucide and browser-local persistence conventions. No new libraries were added. The invoice calculation and finalization functions are unchanged.

## Files changed

| Files | Purpose |
| --- | --- |
| `app/page.tsx` | Replaces the inline POS with its own component; connects the existing invoice engine and preview; restores the last permitted page; protects unsaved bills when navigating, signing out or switching roles; routes global search correctly; restores new-bill focus after printing. |
| `app/globals.css` | POS token reuse, customer form, category cards, compact booking rows, accessible popovers, payment controls, sticky desktop panel, mobile save bar, success actions and shortcut help. |
| `components/billing/billing-pos.tsx` | Coordinates customer lookup, persons, booking lines, payment selection, validation, drafts, reset, save and post-save actions. |
| `components/billing/customer-details.tsx`, `person-stepper.tsx` | Required mobile/name intake, +91 display, ten-digit validation, returning-customer autofill, persons defaults and collapsed optional B2B/contact information. |
| `components/billing/adventure-picker.tsx` | Search and data-derived category filters, distinct category icons, selected quantities and increment-on-repeat selection. |
| `components/billing/booking-rows.tsx`, `date-field.tsx`, `time-slot-picker.tsx` | Compact desktop rows and stacked smaller-screen cards; Indian date entry; preset/custom times; apply-to-all controls; permission-based price editing. |
| `components/billing/payment-section.tsx`, `save-actions.tsx`, `shortcuts-help.tsx` | Full/partial/unpaid and split payments, synchronized full amounts, quick partial percentages, visible balance/status, save controls and shortcut reference. |
| `hooks/use-billing-draft.ts` | Schema-checked draft restoration, debounced autosave, synchronous leave-time persistence, storage-failure feedback and before-unload protection. |
| `hooks/use-pos-shortcuts.ts`, `lib/pos-shortcuts.ts` | One POS-specific keyboard dispatcher, modifier display, input-typing rules, overlay handling and listener cleanup. |
| `lib/presentation.ts`, `tests/presentation.test.ts` | Keeps the zero-collected status consistently Unpaid, including zero-total drafts, without changing invoice amounts. |
| `lib/billing-ui.ts` | Customer/draft validation and payment-input presentation helpers. Percentage discounts are converted into the existing engine's amount input using its existing rounding helper. |
| `lib/service-catalog.ts`, `lib/model.ts` | Corrected demo categories; `model.ts` changes are limited to importing the corrected seed categories. Prices, GST rates, calculation and invoice finalization logic are unchanged. |
| `tests/billing-ui.test.ts`, `scripts/pos-check.cjs` | New validation/payment/shortcut tests and responsive, keyboard, draft, permission and accessibility browser checks. |
| `scripts/billing-smoke.cjs`, `package.json`, `README.md` | Updates the existing smoke test for the new flow, adds `test:pos`, and includes hooks in linting. |

## Corrected demo categories

| Activity | Old category | Correct category |
| --- | --- | --- |
| Camping by the Ganges | Air adventure | Camping & outdoors |
| Rock Climbing | Water adventure | Land adventure |
| Flying Fox | Mountain trek | Air adventure |
| Valley Nature Walk | Air adventure | Mountain trek |

Existing browser data receives these corrections only when the service ID, name and old category exactly match a known demo entry. Custom categories are preserved. No price or GST rate is inferred from the corrected category.

## Working flow

1. Enter a ten-digit mobile number. Saved customers are matched after normalizing the existing number; their name and optional details are filled automatically. Existing formatted phone numbers are retained when reusing a customer to avoid duplicate records.
2. Set the number of persons, then select activities. A repeated selection adds one participant to that activity. Existing rows can override participants independently.
3. Dates default to today in India and display as DD/MM/YYYY. Choose Morning (09:00), Afternoon (13:00), Evening (17:00), an explicit custom time, or no time. Date and time can be copied to all rows.
4. Unit price editing uses the existing `Billing POS:edit` permission. Receptionist prices are read-only; restored drafts for restricted roles use catalog prices.
5. Full payment follows the grand total. Partial payment requires a positive collected total below the grand total. Split full payments auto-balance their last mode. An explicit Collect later action creates an unpaid bill. Optional adjustments provide amount/percentage discounts, non-taxable charges and IGST selection.
6. Commission details require the existing Agents & Commissions view permission. The referral-agent field remains optional for billing staff.
7. Save & print opens the existing invoice preview. Save bill skips preview. Both validate the form and guard against repeated saving. Success resets the form and offers Print, a user-initiated WhatsApp text draft, and New bill. Closing a new-bill print preview returns focus to the mobile field for the next customer.

Drafts use `adventure-pos-draft-v1:<role>` independently of finalized records. A confirmed New bill or Discard draft clears that role's current draft. Starting a new booking from Customers asks before replacing an existing draft. Browser reloads and navigation are protected when changes are unsaved. Browser storage failures are reported rather than claiming a successful draft save.

## Keyboard shortcuts

- Ctrl/Cmd+P: save and open print preview; suppress the browser print action first.
- Ctrl/Cmd+S or Ctrl/Cmd+Enter: save bill.
- Ctrl/Cmd+K: global workspace search.
- `/`: focus adventure search.
- Alt+N: new bill, confirming unsaved changes.
- Alt+F: mark fully paid.
- Alt+1/2/3/4: Cash, UPI, Card, Bank Transfer.
- `?`: shortcut help.
- Escape: close the active dialog/popover.

Non-modifier shortcuts do not run while typing in inputs, selects, textareas or editable content. The POS listener is removed when the page unmounts. Save/print combinations do not create another bill while a modal is open. Button hints use the platform's Ctrl or Command symbol.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
# With a production server running (npm run start):
npm run test:pos
npm run test:e2e
npm run test:dashboard
```

There are now 30 unit/integration tests in total, including service-image validation. The POS browser suite checks 1440px, 1024px, 768px and 390px views, no page overflow, visible save/total controls, a 12px minimum, and automated axe WCAG A/AA checks. It also exercises returning customers, B2B fields, mixed GST, percentage discounts, split partial payments, date/time application, draft restoration, leaving-page warnings, keyboard-only billing, Ctrl+P prevention, role-separated drafts and restricted prices/commission visibility. Artifacts are saved under `/tmp/adventure-pos-review`.

## Boundaries

- The optional Recent/Popular activity row was not added; the full searchable catalog and category filters are available.
- WhatsApp opens a reviewable text draft; it does not automatically send messages or attach a PDF. Printing uses the existing browser/PDF workflow, not physical-printer integration.
- Drafts remain browser-local and role-separated in this prototype; they are not a cloud backup or production security boundary.
- Production is published separately to https://adventure-business-suite.vercel.app.
