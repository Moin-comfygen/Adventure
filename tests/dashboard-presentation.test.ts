import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previousBounds,
  percentChange,
  previousMetrics,
  dashboardSeries,
} from "../lib/dashboard-presentation";
import { seed } from "../lib/model";
test("equivalent prior ranges handle custom dates and month-to-date", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  assert.deepEqual(previousBounds("month", "", "", now), {
    start: "2026-10-01",
    end: "2026-10-14",
  });
  assert.deepEqual(previousBounds("all", "2026-11-01", "2026-11-07", now), {
    start: "2026-10-25",
    end: "2026-10-31",
  });
  assert.equal(previousBounds("all", "", "", now), null);
  assert.deepEqual(
    previousBounds("year", "", "", new Date("2024-02-29T12:00:00Z")),
    { start: "2023-01-01", end: "2023-02-28" },
  );
});
test("missing comparison data never produces an invented percentage", () => {
  assert.equal(percentChange(100), undefined);
  assert.equal(percentChange(100, 0), undefined);
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(0, 100), -100);
  assert.equal(previousMetrics([], "month")?.revenue, undefined);
});
test("chart presentation preserves source totals and payment dates", () => {
  const invoice = {
    ...seed().invoices[0],
    date: "2026-11-01T10:00:00Z",
    base: 1000,
    charges: 50,
    total: 1100,
    payments: [{ method: "Cash", amount: 500, date: "2026-11-03T10:00:00Z" }],
  };
  const before = JSON.stringify(invoice);
  const data = dashboardSeries([invoice], "all", "2026-11-01", "2026-11-07");
  assert.equal(data.length, 7);
  assert.equal(data[0].revenue, 1050);
  assert.equal(data[0].collections, 0);
  assert.equal(data[2].collections, 500);
  assert.equal(
    data.reduce((n, p) => n + p.revenue, 0),
    1050,
  );
  assert.equal(JSON.stringify(invoice), before);
});
