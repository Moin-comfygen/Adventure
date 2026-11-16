import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { seed, paid } from "../lib/model";
import { indiaDay } from "../lib/sales-ledger";
import {
  makeCustomerBooking,
  collectBookingPayment,
} from "../lib/bookings/domain";
import {
  publishBookingSite,
  getBookingSite,
  publicSite,
  submitCustomerBooking,
  listCustomerBookings,
  recordCustomerPayment,
} from "../lib/bookings/repository";
const s = seed();
const fixture = {
  id: "default",
  slug: "test-link",
  business: s.business,
  services: s.services,
  template: s.templates[0],
  publishedAt: new Date().toISOString(),
};
const input = () => ({
  requestId: randomUUID(),
  name: "Booking Guest",
  phone: "+91 91234 56789",
  persons: 2,
  serviceIds: [s.services[0].id],
  date: indiaDay(),
  notes: "",
});
test("customer booking ignores forged totals, normalizes phone and snapshots prices/GST", () => {
  const b = makeCustomerBooking(
    { ...input(), total: 1, collected: 99999 },
    fixture,
  );
  assert.equal(b.phone, "9123456789");
  assert.equal(b.total, 3150);
  assert.equal(b.collected, 0);
  assert.equal(b.balance, 3150);
  assert.equal(b.status, "Awaiting payment");
  assert.equal(b.paymentOption, "reception");
  assert.equal(b.source, "customer");
  assert.throws(() =>
    makeCustomerBooking({ ...input(), persons: 1.5 }, fixture),
  );
  assert.throws(() =>
    makeCustomerBooking({ ...input(), serviceIds: ["unknown"] }, fixture),
  );
  assert.throws(() =>
    makeCustomerBooking({ ...input(), date: "2020-01-01" }, fixture),
  );
});
test("reception collections use the existing invoice engine and preserve one receipt", () => {
  const b = makeCustomerBooking(input(), fixture);
  const partial = collectBookingPayment(
    b,
    { requestId: randomUUID(), amount: 1000, method: "Cash" },
    "Reception",
  );
  assert.equal(partial.status, "Partial");
  assert.equal(partial.balance, 2150);
  assert.equal(partial.invoice?.createdBy, "Receptionist");
  assert.equal(partial.invoice?.tax, 150);
  assert.equal(partial.invoice?.customerBookingId, b.id);
  assert.deepEqual(partial.invoice?.businessSnapshot, s.business);
  const full = collectBookingPayment(
    partial,
    { requestId: randomUUID(), amount: 2150, method: "UPI" },
    "Reception",
  );
  assert.equal(full.invoice?.id, partial.invoice?.id);
  assert.equal(full.status, "Paid");
  assert.equal(paid(full.invoice!), 3150);
  assert.throws(() =>
    collectBookingPayment(
      full,
      { requestId: randomUUID(), amount: 1, method: "Cash" },
      "Reception",
    ),
  );
  assert.throws(() =>
    collectBookingPayment(
      b,
      { requestId: randomUUID(), amount: 3151, method: "Cash" },
      "Admin",
    ),
  );
});
test("durable booking repository deduplicates submissions and serializes competing payments", async () => {
  delete process.env.VERCEL;
  delete process.env.DATABASE_URL;
  process.env.BOOKING_LOCAL_SQLITE = join(
    mkdtempSync(join(tmpdir(), "adventure-bookings-")),
    "bookings.sqlite",
  );
  const config = {
    business: s.business,
    services: s.services,
    template: s.templates[0],
  };
  const sites = await Promise.all([
    publishBookingSite(config),
    publishBookingSite(config),
  ]);
  assert.equal(sites[0].slug, sites[1].slug);
  const site = await getBookingSite();
  assert(site);
  assert.equal((await getBookingSite(site.slug))?.slug, site.slug);
  assert.equal("template" in publicSite(site), false);
  const raw = input();
  const [a, b] = await Promise.all([
    submitCustomerBooking(site.slug, raw),
    submitCustomerBooking(site.slug, raw),
  ]);
  assert.equal(a.id, b.id);
  assert.equal((await listCustomerBookings(1, "")).total, 1);
  await assert.rejects(
    submitCustomerBooking(site.slug, { ...raw, name: "Different Guest" }),
    /changed/,
  );
  const request = { requestId: randomUUID(), amount: 1000, method: "Cash" };
  const first = await recordCustomerPayment(a.id, request, "Reception");
  const replay = await recordCustomerPayment(a.id, request, "Reception");
  assert.equal(first.collected, 1000);
  assert.equal(replay.collected, 1000);
  assert.equal(replay.invoice?.payments.length, 1);
  await assert.rejects(
    recordCustomerPayment(a.id, { ...request, amount: 2 }, "Admin"),
    /reused/,
  );
  const results = await Promise.allSettled([
    recordCustomerPayment(
      a.id,
      { requestId: randomUUID(), amount: 2150, method: "UPI" },
      "Admin",
    ),
    recordCustomerPayment(
      a.id,
      { requestId: randomUUID(), amount: 2150, method: "UPI" },
      "Reception",
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const final = (await listCustomerBookings(1, "Paid")).bookings[0];
  assert.equal(final.collected, 3150);
  assert.equal(final.balance, 0);
  assert.equal(final.invoice?.payments.length, 2);
  assert.equal(final.invoice?.id, first.invoice?.id);
  // Existing requests return their original snapshot after catalog changes.
  await publishBookingSite({
    ...config,
    services: [{ ...s.services[0], price: 2000 }],
  });
  const repeated = await submitCustomerBooking(site.slug, raw);
  assert.equal(repeated.total, 3150);
  const fresh = await submitCustomerBooking(site.slug, {
    ...input(),
    requestId: randomUUID(),
  });
  assert.equal(fresh.total, 4200);
});
