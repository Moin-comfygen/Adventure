import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readWorkbook } from "../lib/workbook";
import { collectionTotal, inPeriod } from "../lib/analytics";
import { seed } from "../lib/model";
test("CSV preserves ISO dates, mobile numbers and quoted cells", async () => {
  const text =
    'externalId,name,phone,date\r\n1,"Guest, One",0987654321,2026-11-14';
  const result = await readWorkbook(
    new TextEncoder().encode(text).buffer,
    "sales.csv",
  );
  assert.equal(result[0].date, "2026-11-14");
  assert.equal(result[0].name, "Guest, One");
  assert.equal(result[0].phone, "0987654321");
});
test("XLSX round trip supports import templates", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Sales");
  sheet.addRow(["externalId", "name", "phone", "date"]);
  sheet.addRow(["X-1", "Amit Sharma", "9876543210", "2026-11-14"]);
  const buffer = await book.xlsx.writeBuffer();
  const rows = await readWorkbook(buffer as ArrayBuffer, "sales.xlsx");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].externalId, "X-1");
  assert.equal(rows[0].date, "2026-11-14");
});
test("collections follow payment dates rather than original invoice dates", () => {
  const s = seed();
  const i = s.invoices[0];
  i.date = "2025-01-01";
  i.payments = [{ method: "UPI", amount: 100, date: "2026-11-14" }];
  assert.equal(
    collectionTotal([i], (date) =>
      inPeriod(date, "all", "2026-11-14", "2026-11-14"),
    ),
    100,
  );
  assert.equal(
    collectionTotal([i], (date) =>
      inPeriod(date, "all", "2025-01-01", "2025-01-01"),
    ),
    0,
  );
});
