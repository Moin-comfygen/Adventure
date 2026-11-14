import { Invoice, paid, round, State } from "./model";
export const dateIN = (value: string) => {
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? day.split("-").reverse().join("/")
    : value;
};
export const amountIN = (value: number) =>
  value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const ledgerStatus = (i: Invoice) =>
  i.status !== "Active"
    ? i.status
    : paid(i) === 0
      ? "Unpaid"
      : paid(i) < i.total
        ? "Partial"
        : "Paid";
export const balance = (i: Invoice) =>
  i.status === "Active" ? round(i.total - paid(i)) : 0;
export function ledgerTotals(invoices: Invoice[]) {
  const active = invoices.filter((i) => i.status === "Active");
  const sum = (rows: Invoice[], fn: (i: Invoice) => number) =>
    round(rows.reduce((s, i) => s + fn(i), 0));
  const gross = sum(active, (i) => i.total),
    gst = sum(active, (i) => i.tax),
    refunded = sum(
      invoices.filter((i) => i.status === "Refunded"),
      paid,
    );
  const collected = sum(
    invoices.filter((i) => i.status !== "Cancelled"),
    paid,
  );
  return {
    gross,
    gst,
    net: round(gross - gst),
    collected,
    outstanding: round(gross - collected + refunded),
    refunded,
    count: invoices.length,
  };
}
export const kpiInfo = {
  gross: [
    "Gross sales (incl. GST)",
    "Active invoices after discounts and charges; cancelled and refunded sales are reversed.",
  ],
  gst: [
    "GST",
    "GST on active invoices, calculated by the unchanged invoice engine.",
  ],
  net: [
    "Net sales (excl. GST)",
    "Gross sales less GST, including non-taxable additional charges.",
  ],
  collected: [
    "Collected",
    "Original receipts on active and refunded invoices before refund adjustments; cancelled invoices excluded.",
  ],
  outstanding: [
    "Outstanding",
    "Gross − collected + refunded receipts. Only active invoice balances remain due.",
  ],
  refunded: [
    "Refunded",
    "Full receipts returned on refunded invoices. Original invoice snapshots remain unchanged.",
  ],
  count: [
    "Invoice count",
    "All invoice records, including cancelled and refunded records.",
  ],
} as const;
export function agentName(state: State, id: string) {
  return state.agents.find((a) => a.id === id)?.name || "Direct";
}
export type SalesFilters = {
  period: string;
  from: string;
  to: string;
  status: string[];
  payment: string[];
  agent: string[];
  activity: string[];
  min: string;
  max: string;
  q: string;
  metric: string;
  age: string;
};
export const defaultFilters: SalesFilters = {
  period: "month",
  from: "",
  to: "",
  status: [],
  payment: [],
  agent: [],
  activity: [],
  min: "",
  max: "",
  q: "",
  metric: "count",
  age: "",
};
const indiaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const indiaDay = (date = new Date()) => indiaFormatter.format(date);
export function salesBounds(
  f: SalesFilters,
  now = new Date(),
): [string, string] {
  const today = indiaDay(now),
    d = new Date(today + "T12:00:00Z"),
    year = d.getUTCFullYear(),
    month = d.getUTCMonth();
  if (f.period === "custom") return [f.from, f.to];
  if (f.period === "all") return ["", ""];
  let start = today;
  if (f.period === "week") {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    start = d.toISOString().slice(0, 10);
  }
  if (f.period === "month")
    start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  if (f.period === "year") start = `${year}-01-01`;
  if (f.period === "financial") start = `${month < 3 ? year - 1 : year}-04-01`;
  return [start, today];
}
export function ageDays(i: Invoice, now = new Date()) {
  return Math.max(
    0,
    Math.floor(
      (Date.parse(indiaDay(now)) - Date.parse(i.date.slice(0, 10))) / 86400000,
    ),
  );
}
export function filterSales(
  invoices: Invoice[],
  f: SalesFilters,
  now = new Date(),
) {
  const [from, to] = salesBounds(f, now);
  const query = f.q.toLowerCase().trim(),
    todayTime = Date.parse(indiaDay(now));
  return invoices.filter((i) => {
    const day = i.date.slice(0, 10),
      due = balance(i),
      age = Math.max(
        0,
        Math.floor((todayTime - Date.parse(i.date.slice(0, 10))) / 86400000),
      );
    return (
      (!from || day >= from) &&
      (!to || day <= to) &&
      (!f.status.length || f.status.includes(ledgerStatus(i))) &&
      (!f.payment.length ||
        i.payments.some((p) => f.payment.includes(p.method))) &&
      (!f.agent.length || f.agent.includes(i.agentId || "direct")) &&
      (!f.activity.length ||
        i.lines.some((l) => f.activity.includes(l.serviceId))) &&
      (!f.min || i.total >= Number(f.min)) &&
      (!f.max || i.total <= Number(f.max)) &&
      (!query ||
        `${i.id} ${i.externalId || ""} ${i.customer.name} ${i.customer.phone}`
          .toLowerCase()
          .includes(query)) &&
      (!f.age ||
        (due > 0 &&
          (f.age === "0-7"
            ? age <= 7
            : f.age === "8-30"
              ? age >= 8 && age <= 30
              : age >= 31))) &&
      (f.metric === "outstanding"
        ? due > 0
        : f.metric === "refunded"
          ? i.status === "Refunded"
          : f.metric === "collected"
            ? i.status !== "Cancelled" && paid(i) > 0
            : ["gross", "gst", "net"].includes(f.metric)
              ? i.status === "Active"
              : true)
    );
  });
}
export function parseSalesFilters(query: string): SalesFilters {
  const p = new URLSearchParams(query),
    f = { ...defaultFilters };
  for (const key of Object.keys(f) as (keyof SalesFilters)[]) {
    const v = p.get("sales_" + key);
    if (v !== null) {
      if (["status", "payment", "agent", "activity"].includes(key))
        (f[key] as string[]) = v.split("|").filter(Boolean);
      else (f[key] as string) = v;
    }
  }
  if (
    !["today", "week", "month", "year", "financial", "custom", "all"].includes(
      f.period,
    )
  )
    f.period = "month";
  if (
    ![
      "count",
      "gross",
      "gst",
      "net",
      "collected",
      "outstanding",
      "refunded",
    ].includes(f.metric)
  )
    f.metric = "count";
  if (!["", "0-7", "8-30", "31+"].includes(f.age)) f.age = "";
  for (const k of ["min", "max"] as const)
    if (f[k] && (!Number.isFinite(Number(f[k])) || Number(f[k]) < 0)) f[k] = "";
  for (const k of ["from", "to"] as const)
    if (f[k] && !/^\d{4}-\d{2}-\d{2}$/.test(f[k])) f[k] = "";
  return f;
}
export function previousSales(invoices: Invoice[], f: SalesFilters) {
  const [start, end] = salesBounds(f);
  if (!start || !end || end < start) return [];
  const days = Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  const priorEnd = new Date(Date.parse(start) - 86400000)
    .toISOString()
    .slice(0, 10);
  const priorStart = new Date(Date.parse(start) - days * 86400000)
    .toISOString()
    .slice(0, 10);
  return filterSales(invoices, {
    ...f,
    period: "custom",
    from: priorStart,
    to: priorEnd,
  });
}
