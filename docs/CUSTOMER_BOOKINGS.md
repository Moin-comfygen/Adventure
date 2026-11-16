# Customer booking links and reception collections

## What changed

- Invoice WhatsApp actions now always open the billed customer's number through wa.me. They no longer use the operating-system recipient picker. The short default greeting uses the invoice business name: “Hello [customer], greetings from [business]! Thank you for visiting us. Please find your invoice [number] attached.” The PDF downloads before WhatsApp opens; users attach it using Attach → Document. Local PDFs cannot be attached to a specified WhatsApp chat through a browser link. Edited reminders remain editable and retain their custom text.
- A new Customer Bookings workspace page is available to admin, manager and receptionist roles. It has a staff access-code sign-in, one stable public booking link, publishing from the administrator's current business/catalog settings, automatic refresh, pagination, source badges and a Collect payment dialog.
- `/book/[slug]` is a separate customer-facing page without staff navigation. It collects name, Indian WhatsApp/mobile number, persons, activities, date and optional notes. The only payment choice is Pay at reception. Success shows a booking reference and clearly says no online payment was taken.
- Customer requests appear as Booked by customer. Reception can record full or partial Cash/UPI/Card/Bank Transfer payments. An invoice is created on first collection using the unchanged invoice engine and updated on later collections. Server row locks, versioning and idempotency prevent duplicate payments, overcollection and stale receipt updates.
- Shared customer receipts sync into the local sales ledger in protected, paginated batches. New booking payments must be collected through Customer Bookings rather than edited in a browser-local invoice modal. Ordinary POS invoices keep their existing workflow. Cancellation/refund operations for these new shared booking receipts are not implemented; their local mutation buttons are hidden to prevent divergence from the shared store.

## Production activation — required

The original app has browser-local storage and no database or server staff accounts. Public bookings from another phone require a shared database; browser storage and Vercel `/tmp` cannot provide that.

1. Connect a PostgreSQL database to the Vercel project. A free-tier provider such as Neon can supply a pooled connection URL. Set private `DATABASE_URL` (include TLS, e.g. sslmode=require).
2. Set private, distinct `BOOKING_ADMIN_CODE` and `BOOKING_RECEPTION_CODE`, each at least 16 randomly generated characters. Provide the reception code to trusted staff. Never add these to NEXT_PUBLIC variables, source files, URLs or the public booking link.
3. Redeploy. Staff sign in under Customer Bookings. On the admin's own browser, publish the booking page from current business/catalog settings. This avoids silently publishing seed/demo prices when the real catalog exists only on that browser.
4. Copy the generated `/book/[slug]` link and send it to customers. Reception signs into its own booking queue with the reception code.

Until these production settings exist, the new module explicitly says booking links are not activated, and the APIs reject writes. No demo/local-memory success is substituted for durable cloud storage. The code is ready for deployment, but it cannot produce a working production customer link without this setup.

## Storage and permissions

The only added runtime dependency is the small `postgres` client. Tables are initialized lazily with CREATE TABLE IF NOT EXISTS under the adventure_ prefix:

- adventure_booking_sites: stable public slug, business/catalog and staff-only invoice branding.
- adventure_customer_bookings: immutable booking inputs/prices, status and shared receipt.
- adventure_booking_payments: idempotency request IDs and fingerprints.
- adventure_booking_throttle: rate limits for staff sign-in and public submissions.

The database role needs schema creation permission at initial setup, plus normal SELECT/INSERT/UPDATE access. Codes authenticate separate Admin/Reception server capabilities through signed, HttpOnly, SameSite cookies; production cookies are Secure. Reception cannot publish catalog settings. Public routes expose the published business/catalog and a submission's own confirmation, never the staff queue, other customers or invoice signature/template data. Mutations check the public origin/host, including reverse-proxy hosting. Payload size limits, validation, honeypot and rate limits protect the public form.

The customer-selected service IDs and persons determine server-calculated totals. Customer-supplied totals/payment flags are ignored. Replays return the original booking; changes to an existing request ID are rejected. A changed catalog version requires the customer to refresh and review the new total. Service prices and GST remain frozen for an accepted booking; current published invoice branding is shared once per staff profile rather than duplicated into every record. Existing calculate/createInvoice/paid functions are reused without financial formula changes.

Staff receipts are shared, while the original local invoice history and demo-role system remain browser-local. Receptionist history restrictions continue to apply outside the shared booking queue. Staff sign-out and role changes remove the booking-session cookie. The shared store is one business per deployment, not a multi-tenant identity service. Activity availability/capacity management and online payment gateways are not part of this change.

## Local development / verification

Node 24's built-in SQLite provides a real persistent local test adapter when `BOOKING_LOCAL_SQLITE` is explicitly set and `VERCEL` is absent. Production on Vercel never falls back to this adapter. No SQLite dependency was added.

For local checks, use a new `/tmp` database path and local-only test codes:

```
BOOKING_LOCAL_SQLITE=/tmp/adventure-bookings-local.sqlite \
BOOKING_ADMIN_CODE=local-test-admin-booking-code-2026 \
BOOKING_RECEPTION_CODE=local-test-reception-booking-code-2026 \
npm run start -- --port 3014

BASE_URL=http://localhost:3014 node scripts/customer-bookings-check.cjs
BASE_URL=http://localhost:3014 node scripts/whatsapp-check.cjs
```

The browser test uses separate customer/admin/reception browser contexts against real API routes and a shared persistent test database. It verifies the public form, reception collection, duplicate/concurrent payment protection, customer privacy, reception publishing restrictions, cross-origin rejection, receipt sync into Sales, and responsive accessibility. Tests use synthetic customer data and mock WhatsApp destinations so no external message is sent.

Main files: `components/bookings/*`, `lib/bookings/*`, `app/book/[slug]/page.tsx`, `app/api/booking-staff/*`, `app/api/customer-booking/[slug]/route.ts`, `hooks/use-booking-receipts.ts`, `app/page.tsx`, `app/globals.css`, invoice-sharing components/helpers, model metadata/permissions, and new booking/security/browser tests.

Verified implementation: build, typecheck, lint and all 50 unit/integration tests pass. Separate customer/admin/reception browser sessions against the persistent local test database pass booking submission, partial/full payment, identical-request replay, competing collectors, receipt synchronization into Sales, private access, reception publishing restrictions and CSRF checks. Public booking layout passes 1440/1024/768/390px with no overflow or axe A/AA violations; reception mobile checks pass. Existing POS, WhatsApp and sales/report browser checks pass, including a 5,000-invoice ledger fixture. Production activation remains blocked until the required database/staff environment settings are connected.
