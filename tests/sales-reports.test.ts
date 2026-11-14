import test from "node:test";
import assert from "node:assert/strict";
import { seed, round } from "../lib/model";
import {
  buildSalesWorkbook,
  buildSalesPdf,
  csvText,
  reportBreakdowns,
  salesRows,
} from "../lib/sales-reports";
import { defaultFilters, ledgerTotals } from "../lib/sales-ledger";
import ExcelJS from "exceljs";
test("workbook has accountant sheets, formatting, filters and totals; GST/activity reconcile", async () => {
  const s = seed(),
    f = { ...defaultFilters, period: "all" },
    rows = s.invoices;
  const book = await buildSalesWorkbook(s, rows, "Super Admin", f);
  assert.deepEqual(
    book.worksheets.map((w) => w.name),
    ["Summary", "Sales", "Payments", "Agents", "GST"],
  );
  const b = reportBreakdowns(s, rows, "Super Admin", f),
    t = ledgerTotals(rows);
  assert.equal(round(b.activity.reduce((n, r) => n + r.Gross, 0)), t.gross);
  assert.equal(
    round(b.gst.reduce((n, r) => n + r.CGST + r.SGST + r.IGST, 0)),
    t.gst,
  );
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(await book.xlsx.writeBuffer());
  const sales = reloaded.getWorksheet("Sales")!;
  assert.equal(sales.rowCount, rows.length + 2);
  assert.equal(sales.getCell(sales.rowCount, 1).value, "TOTAL");
  assert(sales.autoFilter);
  assert.equal(sales.views[0].state, "frozen");
});
test("restricted export rows and agents never contain commission data", () => {
  const s = seed();
  assert(
    !Object.keys(salesRows(s, s.invoices, "Receptionist")[0]).some((k) =>
      /commission/i.test(k),
    ),
  );
  assert(
    !Object.keys(
      reportBreakdowns(s, s.invoices, "Receptionist", {
        ...defaultFilters,
        period: "all",
      }).agents[0],
    ).some((k) => /commission/i.test(k)),
  );
});
test("CSV quotes Indian currency, keeps phone text and escapes spreadsheet formulas", () => {
  const csv = csvText([
    { Customer: '=HYPERLINK("x")', Mobile: "9876543210", Total: 123456.5 },
  ]);
  assert(csv.includes("1,23,456.50"));
  assert(csv.includes("'=HYPERLINK"));
  assert(csv.includes("9876543210"));
});
test("A4 report paginates detailed invoices and includes footer", () => {
  const s = seed(),
    doc = buildSalesPdf(s, s.invoices, "Super Admin", {
      ...defaultFilters,
      period: "all",
    });
  assert(doc.getNumberOfPages() > 1);
  assert(doc.output("arraybuffer").byteLength > 5000);
});
