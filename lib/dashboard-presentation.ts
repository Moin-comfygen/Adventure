import { Invoice, paid, round } from "./model";
import { inPeriod, collectionTotal } from "./analytics";
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const dateAt = (iso: string) => new Date(iso + "T12:00:00Z");
export function periodBounds(
  range: string,
  from = "",
  to = "",
  now = new Date(),
): { start: string; end: string } | null {
  if (from && to) return { start: from, end: to };
  if (range === "all") return null;
  const start = dateAt(isoDay(now));
  if (range === "week") start.setUTCDate(start.getUTCDate() - 6);
  if (range === "month") start.setUTCDate(1);
  if (range === "year") {
    start.setUTCMonth(0);
    start.setUTCDate(1);
  }
  return { start: isoDay(start), end: isoDay(now) };
}
export function previousBounds(
  range: string,
  from = "",
  to = "",
  now = new Date(),
) {
  const current = periodBounds(range, from, to, now);
  if (!current) return null;
  const start = dateAt(current.start),
    end = dateAt(current.end);
  if (!from && !to && (range === "month" || range === "year")) {
    const months = range === "year" ? 12 : 1;
    start.setUTCMonth(start.getUTCMonth() - months);
    const targetMonth = end.getUTCMonth() - months,
      day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(targetMonth);
    end.setUTCDate(
      Math.min(
        day,
        new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
  } else {
    const length = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    start.setUTCDate(start.getUTCDate() - length);
    end.setUTCDate(end.getUTCDate() - length);
  }
  return { start: isoDay(start), end: isoDay(end) };
}
export function percentChange(current: number, previous?: number) {
  if (previous === undefined || previous === 0) return undefined;
  return round(((current - previous) / Math.abs(previous)) * 100);
}
export function previousMetrics(
  invoices: Invoice[],
  range: string,
  from = "",
  to = "",
  now = new Date(),
) {
  const bounds = previousBounds(range, from, to, now);
  if (!bounds) return undefined;
  const list = invoices.filter((i) =>
    inPeriod(i.date, "all", bounds.start, bounds.end),
  );
  const paymentFound = invoices.some((i) =>
    i.payments.some((p) => inPeriod(p.date, "all", bounds.start, bounds.end)),
  );
  return {
    revenue: list.length
      ? round(list.reduce((a, i) => a + i.base + i.charges, 0))
      : undefined,
    collections: paymentFound
      ? collectionTotal(invoices, (d) =>
          inPeriod(d, "all", bounds.start, bounds.end),
        )
      : undefined,
    balance: list.length
      ? round(list.reduce((a, i) => a + i.total - paid(i), 0))
      : undefined,
    count: list.length ? list.length : undefined,
  };
}
export function dashboardSeries(
  invoices: Invoice[],
  range: string,
  from = "",
  to = "",
  now = new Date(),
) {
  const dates = invoices
    .flatMap((i) => [
      i.date.slice(0, 10),
      ...i.payments.map((p) => p.date.slice(0, 10)),
    ])
    .sort();
  const bounds = periodBounds(range, from, to, now) || {
    start: dates[0] || isoDay(now),
    end: dates.at(-1) || isoDay(now),
  };
  const start = dateAt(bounds.start),
    end = dateAt(bounds.end);
  const monthly = (end.getTime() - start.getTime()) / 86400000 > 120;
  const keys: string[] = [];
  const cursor = new Date(start);
  if (monthly) cursor.setUTCDate(1);
  while (cursor <= end) {
    keys.push(isoDay(cursor).slice(0, monthly ? 7 : 10));
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (keys.length > 400) break;
  }
  return keys.map((key) => {
    const bucket = invoices.filter(
      (i) => i.date.startsWith(key) && inPeriod(i.date, range, from, to, now),
    );
    const collections = collectionTotal(
      invoices,
      (d) => d.startsWith(key) && inPeriod(d, range, from, to, now),
    );
    const revenue = round(bucket.reduce((a, i) => a + i.base + i.charges, 0));
    return {
      key,
      day: new Date(
        key.length === 7 ? key + "-01T12:00:00Z" : key + "T12:00:00Z",
      ).toLocaleDateString(
        "en-IN",
        monthly
          ? { month: "short", year: "2-digit" }
          : { day: "numeric", month: "short" },
      ),
      revenue,
      collections,
      balance: round(bucket.reduce((a, i) => a + i.total - paid(i), 0)),
      gap: round(Math.max(0, revenue - collections)),
      count: bucket.length,
    };
  });
}
