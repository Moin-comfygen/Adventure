import { test } from "node:test";
import assert from "node:assert/strict";
import {
  customerSchema,
  emptyCustomer,
  mobileDigits,
  resolvedPayments,
  paymentError,
  percentagePayments,
  billingDraftSchema,
} from "../lib/billing-ui";
import { matchPosShortcut, shortcutModifier } from "../lib/pos-shortcuts";
import { correctDemoCategories } from "../lib/service-catalog";
import { seed, calculate } from "../lib/model";
test("customer validation requires ten mobile digits and preserves optional B2B fields", () => {
  assert(
    customerSchema.safeParse({
      ...emptyCustomer,
      name: "Amit",
      phone: "9876543210",
    }).success,
  );
  assert(
    !customerSchema.safeParse({
      ...emptyCustomer,
      name: "Amit",
      phone: "98765",
    }).success,
  );
  assert(
    !customerSchema.safeParse({
      ...emptyCustomer,
      name: "",
      phone: "9876543210",
    }).success,
  );
  assert(
    customerSchema.safeParse({
      ...emptyCustomer,
      name: "Amit",
      phone: "9876543210",
      gstin: "05ABCDE1234F1Z5",
      address: "Rishikesh",
    }).success,
  );
  assert.equal(mobileDigits("+91 98765 43210"), "9876543210");
});
test("full payment tracks changes to the grand total including split remainder", () => {
  assert.deepEqual(
    resolvedPayments("full", [{ method: "UPI", amount: 0 }], 3150),
    [{ method: "UPI", amount: 3150 }],
  );
  assert.equal(
    resolvedPayments("full", [{ method: "UPI", amount: 0 }], 6300)[0].amount,
    6300,
  );
  const rows = [
    { method: "Cash", amount: 1000 },
    { method: "UPI", amount: 0 },
  ];
  assert.equal(resolvedPayments("full", rows, 3150)[1].amount, 2150);
  assert.equal(paymentError("full", rows, 3150), "");
  assert(
    paymentError(
      "full",
      [
        { method: "Cash", amount: 4000 },
        { method: "UPI", amount: 0 },
      ],
      3150,
    ),
  );
});
test("partial payment bounds and unpaid action are explicit", () => {
  for (const value of [0, -1, 3150, 4000])
    assert(paymentError("partial", [{ method: "Cash", amount: value }], 3150));
  assert.equal(
    paymentError("partial", [{ method: "Cash", amount: 1500 }], 3150),
    "",
  );
  assert.deepEqual(
    resolvedPayments("unpaid", [{ method: "UPI", amount: 1000 }], 3150),
    [],
  );
  assert.equal(paymentError("unpaid", [], 3150), "");
  const rows = percentagePayments(
    [
      { method: "Cash", amount: 100 },
      { method: "UPI", amount: 200 },
    ],
    787.5,
  );
  assert.equal(
    rows.reduce((n, p) => n + p.amount, 0),
    787.5,
  );
});
test("demo category corrections leave custom categories and financial fields intact", () => {
  const s = seed();
  assert.equal(s.services[6].category, "Camping & outdoors");
  assert.equal(s.services[7].category, "Land adventure");
  assert.equal(s.services[8].category, "Air adventure");
  assert.equal(s.services[9].category, "Mountain trek");
  const changed = { ...s.services[6], category: "Air adventure" };
  const migrated = correctDemoCategories([
    changed,
    { ...s.services[7], category: "Custom climbing" },
  ]);
  assert.equal(migrated[0].price, changed.price);
  assert.equal(migrated[0].gst, changed.gst);
  assert.equal(migrated[1].category, "Custom climbing");
});
test("UI percent discount maps to existing engine values without changing GST or commission", () => {
  const s = seed();
  const service = s.services[0];
  const line = {
    serviceId: service.id,
    name: service.name,
    price: service.price,
    qty: 2,
    gst: service.gst,
    date: "2026-11-14",
    slot: "",
  };
  const totals = calculate([line], 300, 0, s.agents[0]);
  assert.equal(totals.base, 2700);
  assert.equal(totals.tax, 135);
  assert.equal(totals.commission, 270);
  assert.equal(totals.total, 2835);
});
test("draft schema preserves incomplete customer input but rejects corrupted data", () => {
  const draft = {
    version: 1,
    customer: { ...emptyCustomer, phone: "987" },
    persons: 2,
    lines: [],
    discountValue: 0,
    discountType: "amount",
    charges: 0,
    agentId: "",
    interstate: false,
    paymentMode: "full",
    paymentRows: [{ method: "UPI", amount: 0 }],
  };
  assert(billingDraftSchema.safeParse(draft).success);
  assert(
    !billingDraftSchema.safeParse({ ...draft, lines: [{ serviceId: "x" }] })
      .success,
  );
});
test("central shortcut matching handles modifiers, typing and repeated events", () => {
  const event = { key: "p", ctrlKey: true, metaKey: false, altKey: false };
  assert.equal(matchPosShortcut(event, true), "save-print");
  assert.equal(
    matchPosShortcut(
      { ...event, ctrlKey: false, metaKey: true, key: "Enter" },
      true,
    ),
    "save",
  );
  assert.equal(
    matchPosShortcut({ ...event, ctrlKey: false, key: "/" }, false),
    "focus-activities",
  );
  assert.equal(
    matchPosShortcut({ ...event, ctrlKey: false, key: "/" }, true),
    null,
  );
  assert.equal(
    matchPosShortcut(
      { ...event, ctrlKey: false, altKey: true, key: "n" },
      true,
    ),
    null,
  );
  assert.equal(
    matchPosShortcut(
      { ...event, ctrlKey: false, altKey: true, key: "2" },
      false,
    ),
    "upi",
  );
  assert.equal(matchPosShortcut({ ...event, repeat: true }), null);
  assert.equal(shortcutModifier("MacIntel"), "⌘");
  assert.equal(shortcutModifier("Linux x86_64"), "Ctrl");
});
