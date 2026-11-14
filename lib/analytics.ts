import { Invoice, round } from "./model";
export function inPeriod(
  date: string,
  range: string,
  from = "",
  to = "",
  now = new Date(),
) {
  const day = date.slice(0, 10);
  if (from || to) return (!from || day >= from) && (!to || day <= to);
  const current = now.toISOString();
  if (range === "today") return day === current.slice(0, 10);
  if (range === "week") {
    const delta = now.getTime() - new Date(date).getTime();
    return delta >= 0 && delta < 7 * 86400000;
  }
  if (range === "month") return day.slice(0, 7) === current.slice(0, 7);
  if (range === "year") return day.slice(0, 4) === current.slice(0, 4);
  return true;
}
export function collectionTotal(
  invoices: Invoice[],
  match: (date: string) => boolean,
  method?: string,
) {
  return round(
    invoices.reduce(
      (a, i) =>
        a +
        i.payments
          .filter((p) => match(p.date) && (!method || p.method === method))
          .reduce((b, p) => b + p.amount, 0),
      0,
    ),
  );
}
