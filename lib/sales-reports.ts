import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import {
  calculate,
  Invoice,
  paid,
  State,
  Role,
  allowed,
  round,
  settled,
  earned,
} from "./model";
import {
  agentName,
  amountIN,
  balance,
  dateIN,
  ledgerStatus,
  ledgerTotals,
  SalesFilters,
  salesBounds,
  indiaDay,
} from "./sales-ledger";
import { downloadBlob } from "./sales-import";
export type ReportRow = Record<string, string | number>;
export function salesRows(
  state: State,
  invoices: Invoice[],
  role: Role,
): ReportRow[] {
  return invoices.map((i) => ({
    Invoice: i.id,
    "Invoice Ref": i.externalId || "",
    Date: dateIN(i.date),
    Customer: i.customer.name,
    Mobile: i.customer.phone,
    Email: i.customer.email,
    GSTIN: i.customer.gstin || "",
    Activities: i.lines.map((l) => `${l.name} (${l.qty})`).join("; "),
    Subtotal: i.subtotal,
    Discount: i.discount,
    "Additional charges": i.charges,
    GST: i.tax,
    Total: i.total,
    Paid: paid(i),
    Balance: balance(i),
    Agent: agentName(state, i.agentId),
    ...(allowed(state, role, "Agents & Commissions")
      ? { Commission: i.status === "Active" ? i.commission : 0 }
      : {}),
    Status: ledgerStatus(i),
    "Refund amount": i.status === "Refunded" ? paid(i) : 0,
    "Refund reason":
      i.status === "Refunded"
        ? i.refundReason || "Not recorded (legacy invoice)"
        : "",
  }));
}
export function reportBreakdowns(
  state: State,
  invoices: Invoice[],
  role: Role,
  filters: SalesFilters,
) {
  const activity = new Map<
      string,
      {
        Activity: string;
        Participants: number;
        Net: number;
        GST: number;
        Gross: number;
      }
    >(),
    gst = new Map<
      number,
      {
        Rate: string;
        Taxable: number;
        CGST: number;
        SGST: number;
        IGST: number;
      }
    >();
  const active = invoices.filter((i) => i.status === "Active");
  for (const i of active) {
    const taxes = calculate(i.lines, i.discount, i.charges).taxes;
    let remaining = round(i.base);
    i.lines.forEach((line, index) => {
      const net =
        index === i.lines.length - 1
          ? remaining
          : round(
              line.price *
                line.qty *
                (1 - (i.subtotal ? i.discount / i.subtotal : 0)),
            );
      remaining = round(remaining - net);
      const tax = taxes[index];
      const a = activity.get(line.name) || {
        Activity: line.name,
        Participants: 0,
        Net: 0,
        GST: 0,
        Gross: 0,
      };
      a.Participants += line.qty;
      a.Net = round(a.Net + net);
      a.GST = round(a.GST + tax);
      a.Gross = round(a.Gross + net + tax);
      activity.set(line.name, a);
      const g = gst.get(line.gst) || {
        Rate: line.gst + "%",
        Taxable: 0,
        CGST: 0,
        SGST: 0,
        IGST: 0,
      };
      g.Taxable = round(g.Taxable + net);
      if (i.interstate) g.IGST = round(g.IGST + tax);
      else {
        const cgst = round(tax / 2);
        g.CGST = round(g.CGST + cgst);
        g.SGST = round(g.SGST + tax - cgst);
      }
      gst.set(line.gst, g);
    });
  }
  const charges = round(active.reduce((s, i) => s + i.charges, 0));
  if (charges)
    activity.set("__charges", {
      Activity: "Additional non-taxable charges",
      Participants: 0,
      Net: charges,
      GST: 0,
      Gross: charges,
    });
  const [from, to] = salesBounds(filters),
    match = (date: string) =>
      (!from || date.slice(0, 10) >= from) && (!to || date.slice(0, 10) <= to);
  const payments = ["Cash", "UPI", "Card", "Bank Transfer"].map((mode) => {
    const receipts = round(
        invoices
          .filter((i) => i.status !== "Cancelled")
          .reduce(
            (s, i) =>
              s +
              i.payments
                .filter((p) => p.method === mode)
                .reduce((n, p) => n + p.amount, 0),
            0,
          ),
      ),
      refunds = round(
        invoices
          .filter((i) => i.status === "Refunded")
          .reduce(
            (s, i) =>
              s +
              i.payments
                .filter((p) => p.method === mode)
                .reduce((n, p) => n + p.amount, 0),
            0,
          ),
      );
    return {
      Mode: mode,
      Receipts: receipts,
      Refunds: refunds,
      Retained: round(receipts - refunds),
    };
  });
  const agents = Array.from(new Set(invoices.map((i) => i.agentId))).map(
    (id) => {
      const rows = active.filter((i) => i.agentId === id);
      return {
        Agent: agentName(state, id),
        Bookings: rows.length,
        Sales: round(rows.reduce((s, i) => s + i.total, 0)),
        ...(allowed(state, role, "Agents & Commissions")
          ? {
              "Commission earned": round(
                rows.reduce((s, i) => s + i.commission, 0),
              ),
              "Commission paid (period)": round(
                state.payouts
                  .filter((p) => p.agentId === id && match(p.date))
                  .reduce((s, p) => s + p.amount, 0),
              ),
              "Commission pending (all time)": round(
                earned(state, id) - settled(state, id),
              ),
            }
          : {}),
      };
    },
  );
  const trend = new Map<
    string,
    { Date: string; Sales: number; Collections: number }
  >();
  const add = (date: string, key: "Sales" | "Collections", amount: number) => {
    if (!match(date)) return;
    const day = date.slice(0, 10),
      row = trend.get(day) || { Date: day, Sales: 0, Collections: 0 };
    row[key] = round(row[key] + amount);
    trend.set(day, row);
  };
  for (const i of active) {
    add(i.date, "Sales", i.total);
    for (const p of i.payments) add(p.date, "Collections", p.amount);
  }
  return {
    activity: [...activity.values()],
    payments,
    agents,
    gst: [...gst.values()],
    trend: [...trend.values()].sort((a, b) => a.Date.localeCompare(b.Date)),
    outstanding: invoices
      .filter((i) => balance(i) > 0)
      .map((i) => ({
        Invoice: i.id,
        Date: dateIN(i.date),
        Customer: i.customer.name,
        Mobile: i.customer.phone,
        Balance: balance(i),
      })),
  };
}
export function exportPeriod(filters: SalesFilters) {
  const [from, to] = salesBounds(filters);
  return `${from ? dateIN(from) : "All dates"} – ${to ? dateIN(to) : "All dates"}`;
}
export async function buildSalesWorkbook(
  state: State,
  invoices: Invoice[],
  role: Role,
  filters: SalesFilters,
) {
  const book = new ExcelJS.Workbook();
  book.creator = role;
  book.created = new Date();
  const summary = book.addWorksheet("Summary"),
    totals = ledgerTotals(invoices),
    breakdowns = reportBreakdowns(state, invoices, role, filters);
  summary.addRows([
    ["Sales report"],
    ["Business", state.business.name],
    ["GSTIN", state.business.gstin],
    ["Period", exportPeriod(filters)],
    [
      "Generated on",
      `${dateIN(indiaDay())} · ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    ],
    ["Generated by", role],
    ["Scope", `${invoices.length} filtered / selected invoice records`],
    [],
    ...Object.entries(totals).map(([k, v]) => [k, v]),
    [],
    [
      "Reconciliation",
      "Gross = Net + GST. Outstanding = Gross − Collected + Refunded.",
    ],
    [
      "Reversed invoices",
      "Gross, Net and GST exclude cancelled/refunded invoices; original rows remain in Sales.",
    ],
    [
      "Collections",
      "Invoice cohort receipts; Payments includes original receipts and refunded receipts separately.",
    ],
    [
      "Trend",
      "Sales by invoice date; collections by payment date within the period, for this invoice cohort.",
    ],
    [
      "Agents",
      "Paid = settlements in period; pending = all-time earned less settlements. Settlements are not linked to individual invoices.",
    ],
  ]);
  summary.columns = [{ width: 28 }, { width: 110 }];
  summary.getRow(1).font = {
    bold: true,
    size: 20,
    color: { argb: "FF0E3B4A" },
  };
  for (let row = 9; row <= 15; row++)
    summary.getCell(row, 2).numFmt = "#,##,##0.00";
  const numeric = (key: string) =>
    ![
      "Mobile",
      "GSTIN",
      "Invoice",
      "Invoice Ref",
      "Date",
      "Status",
      "Rate",
    ].includes(key);
  const add = (name: string, rows: ReportRow[]) => {
    const sheet = book.addWorksheet(name);
    const headers = Object.keys(rows[0] || { Result: "No matching data" });
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(headers.map((h) => row[h] ?? ""));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0E3B4A" },
    };
    headers.forEach((h, index) => {
      sheet.getColumn(index + 1).width = [
        "Activities",
        "Customer",
        "Agent",
        "Refund reason",
      ].includes(h)
        ? 36
        : 24;
      if (rows.some((r) => typeof r[h] === "number"))
        sheet.getColumn(index + 1).numFmt = [
          "Participants",
          "Bookings",
        ].includes(h)
          ? "0"
          : "#,##,##0.00";
    });
    if (rows.length) {
      const total = sheet.addRow(
        headers.map((h, index) =>
          index === 0
            ? "TOTAL"
            : typeof rows[0][h] === "number" && numeric(h)
              ? {
                  formula: `SUM(${sheet.getColumn(index + 1).letter}2:${sheet.getColumn(index + 1).letter}${rows.length + 1})`,
                  result: round(
                    rows.reduce((s, r) => s + Number(r[h] || 0), 0),
                  ),
                }
              : "",
        ),
      );
      total.font = { bold: true };
      total.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6F5F0" },
      };
    }
    if (name === "Sales") {
      const col = headers.indexOf("Status") + 1;
      rows.forEach((r, index) => {
        const color =
          r.Status === "Paid"
            ? "FFDCFCE7"
            : r.Status === "Partial"
              ? "FFFEF3C7"
              : "FFFEE2E2";
        sheet.getCell(index + 2, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color },
        };
      });
    }
    return sheet;
  };
  add("Sales", salesRows(state, invoices, role));
  add("Payments", breakdowns.payments);
  add("Agents", breakdowns.agents);
  add("GST", breakdowns.gst);
  return book;
}
export function csvText(rows: ReportRow[]) {
  const headers = Object.keys(rows[0] || { Result: "No matching data" });
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      headers,
      ...rows.map((r) =>
        headers.map((h) =>
          typeof r[h] === "number" ? amountIN(Number(r[h])) : r[h],
        ),
      ),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
export function buildSalesPdf(
  state: State,
  invoices: Invoice[],
  role: Role,
  filters: SalesFilters,
) {
  const doc = new jsPDF({ format: "a4", unit: "mm" }),
    breakdowns = reportBreakdowns(state, invoices, role, filters);
  let y = 18;
  const clean = (text: string) =>
    text.replaceAll("₹", "INR ").replace(/[−–]/g, "-");
  const header = () => {
    doc.setFontSize(16);
    doc.setTextColor("#0E3B4A");
    doc.text("Sales report", 12, 14);
    doc.setFontSize(9);
    doc.text(
      clean(state.business.name + " | GSTIN " + state.business.gstin),
      12,
      21,
    );
    doc.text(
      clean(exportPeriod(filters) + " | " + role + " | " + dateIN(indiaDay())),
      12,
      27,
    );
    y = 36;
  };
  header();
  const ensure = (height: number) => {
    if (y + height > 280) {
      doc.addPage();
      header();
    }
  };
  const text = (s: string, size = 9) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(s), 186);
    for (const line of lines) {
      ensure(5);
      doc.text(line, 12, y);
      y += 5;
    }
    y += 3;
  };
  text("Summary", 12);
  Object.entries(ledgerTotals(invoices)).forEach(([k, v]) =>
    text(`${k}: ${k === "count" ? v : "INR " + amountIN(v)}`),
  );
  text(
    "Gross = Net + GST. Outstanding = Gross - Collected + Refunded. Gross excludes cancelled/refunded sales. Collections include original receipts before refunds.",
  );
  const table = (title: string, rows: ReportRow[]) => {
    ensure(20);
    text(title, 12);
    if (!rows.length) {
      text("No matching data.");
      return;
    }
    const cols = Object.keys(rows[0]),
      width = 186 / cols.length;
    const labels = cols.map((k) => doc.splitTextToSize(clean(k), width - 3));
    const headerHeight = Math.max(...labels.map((l) => l.length)) * 4 + 4;
    const drawHead = () => {
      doc.setFontSize(8);
      doc.setFillColor("#E6EBEF");
      doc.rect(12, y - 3, 186, headerHeight, "F");
      labels.forEach((l, index) => doc.text(l, 13 + index * width, y));
      y += headerHeight;
    };
    ensure(headerHeight + 12);
    drawHead();
    for (const row of rows) {
      doc.setFontSize(8);
      const cells = cols.map((k) =>
        doc.splitTextToSize(
          clean(
            typeof row[k] === "number"
              ? ["Participants", "Bookings"].includes(k)
                ? String(row[k])
                : amountIN(Number(row[k]))
              : String(row[k]),
          ),
          width - 3,
        ),
      );
      let offset = 0;
      const length = Math.max(...cells.map((c) => c.length));
      while (offset < length) {
        if (y + 8 > 277) {
          doc.addPage();
          header();
          drawHead();
        }
        const capacity = Math.max(1, Math.floor((277 - y - 4) / 4)),
          count = Math.min(capacity, length - offset);
        cells.forEach((lines, index) =>
          doc.text(lines.slice(offset, offset + count), 13 + index * width, y),
        );
        y += count * 4 + 4;
        offset += count;
        doc.setDrawColor("#E6EBEF");
        doc.line(12, y - 3, 198, y - 3);
        if (offset < length) {
          doc.addPage();
          header();
          drawHead();
        }
      }
    }
    y += 6;
  };
  table("By activity", breakdowns.activity);
  table("By payment mode", breakdowns.payments);
  table("By agent", breakdowns.agents);
  table("GST summary", breakdowns.gst);
  table("Outstanding invoices", breakdowns.outstanding);
  table(
    "Detailed invoice list",
    invoices.map((i) => ({
      Invoice: i.id,
      Date: dateIN(i.date),
      Customer: i.customer.name,
      Total: i.total,
      Paid: paid(i),
      Balance: balance(i),
      Status: ledgerStatus(i),
    })),
  );
  table(
    "Detailed activity lines",
    invoices.flatMap((i) =>
      i.lines.map((l) => ({
        Invoice: i.id,
        Activity: l.name,
        Participants: l.qty,
        "Unit price": l.price,
        "GST rate": l.gst + "%",
        Date: dateIN(l.date),
        Slot: l.slot || "—",
      })),
    ),
  );
  table(
    "Customer and tax details",
    invoices.map((i) => ({
      Invoice: i.id,
      Customer: i.customer.name,
      Mobile: i.customer.phone,
      GSTIN: i.customer.gstin || "—",
      Net: round(i.total - i.tax),
      GST: i.tax,
      Discount: i.discount,
      Charges: i.charges,
    })),
  );
  const refunds = invoices.filter((i) => i.status === "Refunded");
  if (refunds.length)
    table(
      "Refund details",
      refunds.map((i) => ({
        Invoice: i.id,
        Amount: paid(i),
        Reason: i.refundReason || "Not recorded (legacy invoice)",
      })),
    );
  text(
    "Payments are receipts for the selected invoice cohort. Agent settlements are shown for the period; pending commission is all-time.",
  );
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`${state.business.name} | Generated by ${role}`, 12, 290);
    doc.text(`Page ${page} of ${pages}`, 175, 290);
  }
  return doc;
}
export async function exportSalesReport(
  format: "xlsx" | "csv" | "pdf",
  state: State,
  invoices: Invoice[],
  role: Role,
  filters: SalesFilters,
) {
  if (
    !allowed(state, role, "Sales Management", "export") &&
    !allowed(state, role, "Reports", "export")
  )
    throw Error("Your role does not permit export.");
  if (format === "xlsx") {
    const book = await buildSalesWorkbook(state, invoices, role, filters);
    downloadBlob(
      new Blob([await book.xlsx.writeBuffer()], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Adventure-Sales-Report.xlsx",
    );
  }
  if (format === "csv")
    downloadBlob(
      new Blob([csvText(salesRows(state, invoices, role))], {
        type: "text/csv;charset=utf-8",
      }),
      "Adventure-Sales-Report.csv",
    );
  if (format === "pdf")
    buildSalesPdf(state, invoices, role, filters).save(
      "Adventure-Sales-Report.pdf",
    );
}
