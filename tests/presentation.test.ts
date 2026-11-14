import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/model";
import {
  invoiceStatus,
  pluralize,
  initials,
  compactMoney,
  parseDisplayDate,
} from "../lib/presentation";
test("invoice presentation distinguishes zero, partial, paid and overdue balances", () => {
  const invoice = { ...seed().invoices[0], total: 100, payments: [] };
  assert.equal(invoiceStatus(invoice).label, "Unpaid");
  const partial = {
    ...invoice,
    payments: [{ method: "Cash", amount: 20, date: "2026-11-14" }],
  };
  assert.equal(invoiceStatus(partial).label, "Partial");
  assert.equal(invoiceStatus(partial).due, 80);
  assert.equal(
    invoiceStatus({
      ...partial,
      payments: [{ ...partial.payments[0], amount: 100 }],
    }).label,
    "Paid",
  );
  assert.equal(
    invoiceStatus({ ...invoice, dueDate: "2026-11-01" }, "2026-11-14").label,
    "Overdue",
  );
  assert.equal(
    invoiceStatus({ ...invoice, status: "Cancelled" }).label,
    "Cancelled",
  );
});
test("shared wording and initials cover singular and lowercase names", () => {
  assert.equal(pluralize(1, "booking"), "1 booking");
  assert.equal(pluralize(2, "participant"), "2 participants");
  assert.equal(initials(" moin "), "M");
  assert.equal(initials("amit sharma rawat"), "AS");
});
test("compact Indian values and Indian date entry", () => {
  assert.equal(compactMoney(0), "₹0");
  assert.equal(compactMoney(15000), "₹15k");
  assert.equal(compactMoney(100000), "₹1L");
  assert.equal(compactMoney(10000000), "₹1Cr");
  assert.equal(parseDisplayDate("14/11/2026"), "2026-11-14");
  assert.equal(parseDisplayDate("31/02/2026"), null);
  assert.equal(parseDisplayDate("11/14/2026"), null);
});
