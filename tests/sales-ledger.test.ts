import test from "node:test";
import assert from "node:assert/strict";
import { seed, round, paid } from "../lib/model";
import {
  filterSales,
  defaultFilters,
  ledgerTotals,
  balance,
  parseSalesFilters,
  salesBounds,
} from "../lib/sales-ledger";
import {
  errorReport,
  applySalesImport,
  buildSalesTemplate,
  importDate,
  normalizeMobile,
  parseSalesFile,
  reviewSalesImport,
  undoSalesImport,
} from "../lib/sales-import";
const row = (s = seed()) => ({
  "Invoice Ref": "TEST-1",
  "Invoice Date": "14/11/2026",
  "Customer Name": "Test Guest",
  Mobile: "+91 98765 43210",
  Activity: s.services[0].name,
  Participants: 1,
  "Amount Paid": 0,
});
test("ledger reconciles full refund receipts and excludes reversed outstanding", () => {
  const s = seed();
  s.invoices[0] = { ...s.invoices[0], status: "Refunded" };
  const t = ledgerTotals(s.invoices);
  assert.equal(t.gross, round(t.net + t.gst));
  assert.equal(t.outstanding, round(t.gross - t.collected + t.refunded));
  assert.equal(
    t.outstanding,
    round(s.invoices.reduce((a, i) => a + balance(i), 0)),
  );
  assert.equal(t.refunded, paid(s.invoices[0]));
});
test("calendar filters use India dates, financial year and URL multi-select", () => {
  const f = parseSalesFilters(
    "?sales_status=Unpaid%7CPartial&sales_period=financial&sales_min=bad",
  );
  assert.deepEqual(f.status, ["Unpaid", "Partial"]);
  assert.equal(f.min, "");
  assert.deepEqual(salesBounds(f, new Date("2026-03-31T22:00:00Z")), [
    "2026-04-01",
    "2026-04-01",
  ]);
});
test("5000 invoices filter without mutating source", () => {
  const s = seed(),
    rows = Array.from({ length: 5000 }, (_, n) => ({
      ...s.invoices[n % s.invoices.length],
      id: String(n),
    }));
  const selected = filterSales(rows, {
    ...defaultFilters,
    period: "all",
    metric: "outstanding",
  });
  assert(selected.length > 0);
  assert.equal(rows.length, 5000);
});
test("dates accept dd/mm/yyyy and serial; reject impossible dates; phone normalized", () => {
  assert.equal(importDate("14/11/2026"), "2026-11-14");
  assert.equal(importDate(46340), "2026-11-14");
  assert.throws(() => importDate("31/02/2026"));
  assert.equal(normalizeMobile("+91 98765 43210"), "9876543210");
});
test("template round trips its two sample rows into one valid invoice", async () => {
  const s = seed(),
    book = await buildSalesTemplate(s),
    buffer = await book.xlsx.writeBuffer();
  const raw = await parseSalesFile({
    name: "template.xlsx",
    size: buffer.byteLength,
    arrayBuffer: async () => buffer as ArrayBuffer,
  });
  assert.equal(raw.length, 2);
  const groups = reviewSalesImport(raw, s);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].issues, []);
  const next = applySalesImport(
    s,
    "Super Admin",
    groups,
    "template.xlsx",
    "skip",
  );
  assert.equal(next.invoices.length, s.invoices.length + 1);
  assert.equal(next.invoices.at(-1)?.lines.length, 2);
});
test("one invalid activity rejects entire invoice; valid invoice imports atomically", () => {
  const s = seed(),
    raw = [
      row(s),
      { ...row(s), Activity: "Unknown" },
      { ...row(s), "Invoice Ref": "TEST-2", Mobile: "9123456789" },
    ];
  const groups = reviewSalesImport(raw, s);
  assert(groups[0].issues.some((e) => e.column === "Activity"));
  const next = applySalesImport(s, "Super Admin", groups, "batch.csv", "skip");
  assert.equal(next.invoices.length, s.invoices.length + 1);
  assert.equal(next.imports[0].failed, 1);
  assert.equal(next.invoices.at(-1)?.externalId, "TEST-2");
  assert.equal(s.invoices.length, 75);
});
test("duplicates skip or overwrite; undo restores original invoices and customers", () => {
  const s = seed(),
    g = reviewSalesImport([row(s)], s),
    first = applySalesImport(s, "Super Admin", g, "one.csv", "skip");
  const skip = applySalesImport(
    first,
    "Super Admin",
    reviewSalesImport([row(s)], first),
    "again.csv",
    "skip",
  );
  assert.equal(skip.imports[0].skipped, 1);
  const overwrite = applySalesImport(
    first,
    "Super Admin",
    reviewSalesImport([{ ...row(s), Participants: 2 }], first),
    "replace.csv",
    "overwrite",
  );
  assert.equal(overwrite.invoices.at(-1)?.id, first.invoices.at(-1)?.id);
  const undo = undoSalesImport(overwrite, "Super Admin");
  assert.deepEqual(undo.invoices, first.invoices);
  const changed = {
    ...overwrite,
    invoices: overwrite.invoices.map((i) =>
      i.externalId === "TEST-1"
        ? {
            ...i,
            payments: [{ method: "Cash", amount: 1, date: "2026-11-14" }],
          }
        : i,
    ),
  };
  assert.throws(() => undoSalesImport(changed, "Super Admin"), /changed/);
  assert.throws(
    () => applySalesImport(s, "Receptionist", g, "no.csv", "skip"),
    /role/,
  );
});
test("undo removes customers created across multiple invoice groups, including an in-file overwrite", () => {
  const s = seed(),
    newRow = { ...row(s), Mobile: "9000012345" };
  const groups = reviewSalesImport(
    [newRow, { ...newRow, "Invoice Ref": "TEST-2", Participants: 2 }],
    s,
  );
  const next = applySalesImport(s, "Super Admin", groups, "two.csv", "skip");
  assert.equal(next.invoices.length, s.invoices.length + 2);
  const undone = undoSalesImport(next, "Super Admin");
  assert.deepEqual(undone.customers, s.customers);
  const dup = reviewSalesImport(
    [newRow, { ...newRow, "Invoice Ref": "TEST-2" }],
    s,
  );
  assert(dup[1].issues.some((i) => i.warning));
  const replaced = applySalesImport(
    s,
    "Super Admin",
    dup,
    "two.csv",
    "overwrite",
  );
  assert.equal(replaced.invoices.length, s.invoices.length + 1);
  const restored = undoSalesImport(replaced, "Super Admin");
  assert.deepEqual(restored.customers, s.customers);
  assert.deepEqual(restored.invoices, s.invoices);
});

test("validation reports typo suggestions and retains full invoice rows in error report", () => {
  const s = seed(),
    raw = [
      row(s),
      {
        ...row(s),
        Activity: "River Rafting · 16 k",
        Email: "bad",
        "Customer GSTIN": "BAD",
      },
    ];
  const groups = reviewSalesImport(raw, s);
  assert(groups[0].issues.some((e) => /Did you mean/.test(e.message)));
  assert(groups[0].issues.some((e) => e.column === "Email"));
  assert(groups[0].issues.some((e) => e.column === "Customer GSTIN"));
  const report = errorReport(raw, groups);
  assert.equal(report.length, 2);
  assert(report.every((r) => r.Reason.includes("Activity")));
});
test("file guards reject wrong extensions, oversize files and more than 2000 rows", async () => {
  await assert.rejects(
    parseSalesFile({
      name: "a.pdf",
      size: 0,
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
    /xlsx/,
  );
  await assert.rejects(
    parseSalesFile({
      name: "a.csv",
      size: 5 * 1024 * 1024 + 1,
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
    /5 MB/,
  );
  const bytes = new TextEncoder().encode(
    "Invoice Ref\n" +
      Array.from({ length: 2001 }, (_, i) => String(i)).join("\n"),
  );
  await assert.rejects(
    parseSalesFile({
      name: "a.csv",
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer,
    }),
    /2,000/,
  );
});
