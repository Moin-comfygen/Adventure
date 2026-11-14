import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  calculate,
  createInvoice,
  earned,
  settled,
  allowed,
  visibleInvoices,
  paid,
  Line,
} from "../lib/model";
const line: Line = {
  serviceId: "s0",
  name: "Rafting",
  price: 5000,
  qty: 1,
  gst: 18,
  date: "2026-11-14",
  slot: "",
};
test("discount precedes GST and commission excludes GST", () => {
  const s = seed(),
    t = calculate([line], 500, 0, s.agents[0]);
  assert.equal(t.base, 4500);
  assert.equal(t.tax, 810);
  assert.equal(t.total, 5310);
  assert.equal(t.commission, 450);
});
test("mixed GST is computed independently per line", () => {
  const t = calculate(
    [
      { ...line, price: 1000, gst: 5 },
      { ...line, price: 2000, gst: 18 },
    ],
    300,
    50,
  );
  assert.deepEqual(t.taxes, [45, 324]);
  assert.equal(t.total, 3119);
});
test("seed has requested counts and consistent balances", () => {
  const s = seed();
  assert.equal(s.customers.length, 100);
  assert.equal(s.invoices.length, 75);
  assert.equal(s.agents.length, 12);
  assert.equal(s.services.length, 10);
  for (const i of s.invoices) {
    assert.equal(i.total, Math.round((i.base + i.tax + i.charges) * 100) / 100);
    assert.ok(paid(i) <= i.total);
  }
});
test("billing updates customer, history, commission and stable duplicate protection", () => {
  const s = seed();
  const input = {
    customer: {
      id: "",
      name: "Test Guest",
      phone: "9876543210",
      email: "",
      notes: "",
    },
    lines: [line],
    discount: 0,
    charges: 0,
    agentId: "a0",
    interstate: false,
    payments: [{ method: "UPI", amount: 1000, date: new Date().toISOString() }],
    externalId: "test-001",
  };
  const next = createInvoice(s, "Manager", input);
  assert.equal(next.invoices.length, 76);
  assert.equal(earned(next, "a0") - earned(s, "a0"), 500);
  assert.equal(next.customers.length, 101);
  assert.throws(() => createInvoice(next, "Manager", input), /Duplicate/);
});
test("receptionist has billing and own history but no financial reports or ledger", () => {
  const s = seed();
  for (const m of [
    "Dashboard",
    "Agents & Commissions",
    "Reports",
    "Settings",
    "Invoice Designer",
    "Team & Permissions",
  ] as const)
    assert.equal(allowed(s, "Receptionist", m), false);
  assert.equal(allowed(s, "Receptionist", "Billing POS", "create"), true);
  assert.equal(visibleInvoices(s, "Receptionist").length, 0);
  assert.equal(allowed(s, "Receptionist", "Sales Management", "export"), false);
});
test("manager overrides are enforced during invoice creation", () => {
  const s = seed();
  s.permissions["Manager:Billing POS:create"] = false;
  assert.throws(() => createInvoice(s, "Manager", {} as never), /permit/);
});
test("cancellation reverses commission without changing original snapshot or payouts", () => {
  const s = seed();
  const i = s.invoices.find((i) => i.agentId === "a0")!;
  const before = earned(s, "a0");
  const payout = settled(s, "a0");
  i.status = "Cancelled";
  assert.equal(
    Math.round((before - earned(s, "a0")) * 100) / 100,
    i.commission,
  );
  assert.equal(settled(s, "a0"), payout);
  assert.ok(i.commission > 0);
});
test("invalid discounts, quantities and overpayment rejected", () => {
  const s = seed();
  assert.throws(() => calculate([line], 6000, 0));
  assert.throws(() => calculate([{ ...line, qty: 0 }], 0, 0));
  assert.throws(
    () =>
      createInvoice(s, "Super Admin", {
        customer: s.customers[0],
        lines: [line],
        discount: 0,
        charges: 0,
        agentId: "",
        interstate: false,
        payments: [{ method: "Cash", amount: 999999, date: "" }],
      }),
    /exceed/,
  );
});
test("fixed commission is captured on transaction", () => {
  const s = seed();
  const a = { ...s.agents[0], fixed: true, rate: 275 };
  assert.equal(calculate([line], 500, 0, a).commission, 275);
});
