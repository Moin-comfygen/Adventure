import ExcelJS from "exceljs";
import {
  calculate,
  createInvoice,
  Customer,
  Invoice,
  Line,
  Role,
  State,
  requirePermission,
} from "./model";
import { indiaDay } from "./sales-ledger";
import { readWorkbook } from "./workbook";
export const importColumns = [
  "Invoice Ref*",
  "Invoice Date*",
  "Customer Name*",
  "Mobile*",
  "Email",
  "Customer GSTIN",
  "Activity*",
  "Participants*",
  "Unit Price",
  "Activity Date",
  "Time Slot",
  "Discount (INR)",
  "Additional Charges (INR)",
  "Interstate (Y/N)",
  "Payment Mode",
  "Amount Paid",
  "Referral Agent",
  "Notes",
];
export const paymentModes = ["Cash", "UPI", "Card", "Bank Transfer"];
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function buildSalesTemplate(state: State) {
  const book = new ExcelJS.Workbook(),
    instructions = book.addWorksheet("Instructions"),
    data = book.addWorksheet("Sales Data"),
    lists = book.addWorksheet("Lists");
  instructions.addRows([
    ["Adventure Business Suite · Sales import"],
    [
      "Use Sales Data; keep column headers. Required columns are marked *. Max 2,000 data rows / 5 MB.",
    ],
    [
      "One invoice can have multiple activity rows sharing Invoice Ref. Invoice-level values must match, or be blank after the first row.",
    ],
    [
      "Invoice Date / Activity Date",
      "dd/mm/yyyy or Excel date cells. Activity Date defaults to Invoice Date.",
    ],
    ["Mobile", "10 Indian digits; +91 and spaces are accepted. Keep as text."],
    [
      "Activity / Referral Agent",
      "Use a dropdown value. Agent optional; active agents only.",
    ],
    [
      "Participants",
      "Whole number >= 1. Unit Price defaults to current service price; GST uses current service GST.",
    ],
    [
      "Discount / Additional Charges / Amount Paid",
      "Invoice-level INR values, repeated consistently or filled only on first row. Paid must be 0 to invoice total.",
    ],
    ["Interstate", "Y or N. Requires business GSTIN for Y."],
    ["Email / Customer GSTIN", "Optional; valid email / 15-character GSTIN."],
    [
      "Duplicates",
      "Matched by Invoice Ref or mobile + invoice date + total. Choose Skip or Overwrite in review.",
    ],
    [
      "Worked example",
      "The two sample activity rows share SAMPLE-MULTI-001 and create ONE invoice. Amount Paid = 0, so it is unpaid.",
    ],
    [
      "Refunds",
      "Import creates active invoices only; refunds use the invoice workflow.",
    ],
    ["Time Slot / Notes", "Optional text."],
  ]);
  instructions.columns = [{ width: 45 }, { width: 115 }];
  instructions.getRow(1).font = { bold: true, size: 16 };
  lists.addRow(["Activity", "Payment Mode", "Referral Agent", "Interstate"]);
  const services = state.services,
    agents = state.agents.filter((a) => a.active);
  for (let i = 0; i < Math.max(services.length, agents.length, 4, 2); i++)
    lists.addRow([
      services[i]?.name || "",
      paymentModes[i] || "",
      agents[i]?.name || "",
      i === 0 ? "Y" : i === 1 ? "N" : "",
    ]);
  lists.columns.forEach((c) => (c.width = 32));
  data.addRow(importColumns);
  data.views = [{ state: "frozen", ySplit: 1 }];
  data.autoFilter = "A1:R3";
  const now = new Date(indiaDay() + "T12:00:00Z");
  if (services.length) {
    [services[0], services[1] || services[0]].forEach((service, index) =>
      data.addRow([
        "SAMPLE-MULTI-001",
        now,
        "Amit Sharma",
        "9876543210",
        "amit@example.com",
        "",
        service.name,
        1,
        "",
        now,
        "",
        0,
        0,
        "N",
        "UPI",
        0,
        "",
        index ? "" : "Multi-activity sample invoice",
      ]),
    );
  }
  data.getColumn(2).numFmt = "dd/mm/yyyy";
  data.getColumn(10).numFmt = "dd/mm/yyyy";
  data.getColumn(4).numFmt = "@";
  for (const col of [9, 12, 13, 16]) data.getColumn(col).numFmt = "#,##,##0.00";
  for (const [col, listCol, len] of [
    [7, "A", services.length],
    [15, "B", 4],
    [17, "C", agents.length],
    [14, "D", 2],
  ] as const) {
    const rangeName = {
      A: "SalesActivities",
      B: "SalesPaymentModes",
      C: "SalesAgents",
      D: "SalesInterstate",
    }[listCol];
    book.definedNames.add(
      `'Lists'!$${listCol}$2:$${listCol}$${Math.max(2, len + 1)}`,
      rangeName,
    );
    for (let row = 2; row <= 2001; row++)
      data.getCell(row, col).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [rangeName],
        showErrorMessage: true,
        errorTitle: "Choose a listed value",
        error: "Use a value from the Lists sheet.",
      };
  }
  for (const sheet of [data, lists]) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0E3B4A" },
    };
    sheet.columns.forEach((c) => (c.width = 24));
  }
  return book;
}
export async function downloadSalesTemplate(state: State) {
  const book = await buildSalesTemplate(state);
  downloadBlob(
    new Blob([await book.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "Adventure-Sales-Import-Template.xlsx",
  );
}
export async function parseSalesFile(file: {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}) {
  if (!/\.(xlsx|csv)$/i.test(file.name))
    throw Error("Upload an .xlsx or .csv file.");
  if (file.size > 5 * 1024 * 1024) throw Error("File exceeds 5 MB.");
  const raw = await readWorkbook(await file.arrayBuffer(), file.name);
  if (!raw.length) throw Error("No sales data rows found.");
  if (raw.length > 2000) throw Error("Maximum 2,000 data rows.");
  const normalize = (key: string) => key.replace(/\*/g, "").trim();
  const headers = Object.keys(raw[0]).map(normalize);
  if (new Set(headers).size !== headers.length)
    throw Error("Duplicate column headers after removing required markers.");
  return raw.map((row) => ({
    ...Object.fromEntries(importColumns.map((k) => [normalize(k), ""])),
    ...Object.fromEntries(
      Object.entries(row).map(([k, v]) => [normalize(k), v]),
    ),
  }));
}
export function importDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 100000
  )
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000)
      .toISOString()
      .slice(0, 10);
  const s = String(value ?? "").trim(),
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const iso = m
    ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
    : s.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    !Number.isFinite(Date.parse(iso)) ||
    new Date(iso).toISOString().slice(0, 10) !== iso
  )
    throw Error("Use a valid dd/mm/yyyy date.");
  return iso;
}
export function normalizeMobile(value: unknown) {
  let s = String(value ?? "").replace(/[\s()+-]/g, "");
  if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
  if (!/^\d{10}$/.test(s))
    throw Error("Enter a 10-digit Indian mobile number.");
  return s;
}
function distance(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = d[j];
      d[j] = Math.min(
        d[j] + 1,
        d[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return d[b.length];
}
function suggestion(value: string, names: string[]) {
  const best = names
    .map((name) => ({
      name,
      d: distance(value.toLowerCase(), name.toLowerCase()),
    }))
    .sort((a, b) => a.d - b.d)[0];
  return best && best.d <= Math.max(3, value.length * 0.4)
    ? ` Did you mean “${best.name}”?`
    : "";
}
export type CellIssue = {
  row: number;
  column: string;
  message: string;
  warning?: boolean;
};
type Input = Parameters<typeof createInvoice>[2];
export type ImportGroup = {
  ref: string;
  rows: number[];
  input?: Input;
  total: number;
  duplicateId?: string;
  issues: CellIssue[];
};
export function reviewSalesImport(
  raw: Record<string, unknown>[],
  state: State,
): ImportGroup[] {
  const grouped = new Map<
    string,
    { row: number; data: Record<string, unknown> }[]
  >();
  raw.forEach((data, index) => {
    const ref = String(data["Invoice Ref"] || "").trim();
    const key = ref || `__missing_${index}`;
    grouped.set(key, [...(grouped.get(key) || []), { row: index + 2, data }]);
  });
  const existingRef = new Map(
      state.invoices.filter((i) => i.externalId).map((i) => [i.externalId!, i]),
    ),
    existingMatch = new Map(
      state.invoices.map((i) => [
        `${i.customer.phone.replace(/\D/g, "").slice(-10)}|${i.date.slice(0, 10)}|${i.total}`,
        i,
      ]),
    );
  const reviewed: ImportGroup[] = [...grouped.entries()].map(
    ([ref, records]) => {
      const issues: CellIssue[] = [],
        first = records[0],
        v = (key: string) => String(first.data[key] ?? "").trim();
      const issue = (
        row: number,
        column: string,
        message: string,
        warning = false,
      ) => issues.push({ row, column, message, warning });
      const checked = <T>(
        row: number,
        column: string,
        fn: () => T,
        fallback: T,
      ) => {
        try {
          return fn();
        } catch (e) {
          issue(row, column, (e as Error).message);
          return fallback;
        }
      };
      if (ref.startsWith("__missing_"))
        issue(first.row, "Invoice Ref", "Invoice Ref is required.");
      const date = checked(
        first.row,
        "Invoice Date",
        () => importDate(first.data["Invoice Date"]),
        "",
      );
      const phone = checked(
        first.row,
        "Mobile",
        () => normalizeMobile(first.data.Mobile),
        "",
      );
      if (!v("Customer Name"))
        issue(first.row, "Customer Name", "Customer name is required.");
      if (v("Email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("Email")))
        issue(first.row, "Email", "Enter a valid email.");
      if (
        v("Customer GSTIN") &&
        !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
          v("Customer GSTIN").toUpperCase(),
        )
      )
        issue(first.row, "Customer GSTIN", "Enter a valid 15-character GSTIN.");
      const number = (
        r: { row: number; data: Record<string, unknown> },
        key: string,
        fallback = 0,
      ) =>
        checked(
          r.row,
          key,
          () => {
            const val = String(r.data[key] ?? "").trim();
            if (!val) return fallback;
            const n = Number(val);
            if (!Number.isFinite(n) || n < 0)
              throw Error("Must be a finite number >= 0.");
            return n;
          },
          fallback,
        );
      const discount = number(first, "Discount (INR)"),
        charges = number(first, "Additional Charges (INR)"),
        amount = number(first, "Amount Paid");
      const inter = v("Interstate (Y/N)").toUpperCase() || "N";
      if (!["Y", "N"].includes(inter))
        issue(first.row, "Interstate (Y/N)", "Use Y or N.");
      if (inter === "Y" && !state.business.gstin)
        issue(
          first.row,
          "Interstate (Y/N)",
          "Configure business GSTIN before interstate billing.",
        );
      const method = v("Payment Mode") || "Cash";
      if (!paymentModes.includes(method))
        issue(
          first.row,
          "Payment Mode",
          "Use Cash, UPI, Card or Bank Transfer.",
        );
      const agent = state.agents.find(
        (a) =>
          a.active &&
          a.name.toLowerCase() === v("Referral Agent").toLowerCase(),
      );
      if (v("Referral Agent") && !agent)
        issue(
          first.row,
          "Referral Agent",
          "Unknown or inactive agent." +
            suggestion(
              v("Referral Agent"),
              state.agents.filter((a) => a.active).map((a) => a.name),
            ),
        );
      const shared = [
        "Invoice Date",
        "Customer Name",
        "Mobile",
        "Email",
        "Customer GSTIN",
        "Discount (INR)",
        "Additional Charges (INR)",
        "Interstate (Y/N)",
        "Payment Mode",
        "Amount Paid",
        "Referral Agent",
      ];
      const lines: Line[] = records.map((r) => {
        for (const key of shared) {
          if (r !== first && String(r.data[key] ?? "").trim()) {
            const original = first.data[key],
              current = r.data[key];
            const norm = (x: unknown) =>
              key === "Mobile"
                ? normalizeMobile(x)
                : key === "Invoice Date"
                  ? importDate(x)
                  : String(x ?? "")
                      .trim()
                      .toLowerCase();
            checked(
              r.row,
              key,
              () => {
                if (norm(original) !== norm(current))
                  throw Error(
                    "Invoice-level value differs from the first row for this Invoice Ref.",
                  );
                return true;
              },
              false,
            );
          }
        }
        const name = String(r.data.Activity || "").trim(),
          service = state.services.find(
            (s) => s.name.toLowerCase() === name.toLowerCase(),
          );
        if (!service)
          issue(
            r.row,
            "Activity",
            name
              ? "Unknown or inactive activity." +
                  suggestion(
                    name,
                    state.services.map((s) => s.name),
                  )
              : "Activity is required.",
          );
        const qty = number(r, "Participants");
        if (!Number.isInteger(qty) || qty < 1)
          issue(
            r.row,
            "Participants",
            "Participants must be a whole number >= 1.",
          );
        return {
          serviceId: service?.id || "",
          name: service?.name || name,
          price: number(r, "Unit Price", service?.price || 0),
          qty,
          gst: service?.gst || 0,
          date: r.data["Activity Date"]
            ? checked(
                r.row,
                "Activity Date",
                () => importDate(r.data["Activity Date"]),
                date,
              )
            : date,
          slot: String(r.data["Time Slot"] || ""),
        };
      });
      const totals = checked(
        first.row,
        "Discount (INR)",
        () => calculate(lines, discount, charges, agent),
        { subtotal: 0, base: 0, tax: 0, total: 0, commission: 0, taxes: [] },
      );
      if (amount > totals.total)
        issue(
          first.row,
          "Amount Paid",
          `Payment exceeds invoice total ${totals.total}.`,
        );
      const duplicate =
        existingRef.get(ref) ||
        existingMatch.get(`${phone}|${date}|${totals.total}`);
      if (duplicate)
        issue(
          first.row,
          "Invoice Ref",
          `Duplicate of ${duplicate.id}: choose Skip or Overwrite.`,
          true,
        );
      const input: Input = {
        externalId: ref,
        date: date + "T12:00:00",
        customer: {
          id: "",
          name: v("Customer Name"),
          phone,
          email: v("Email"),
          gstin: v("Customer GSTIN").toUpperCase(),
          notes: v("Notes"),
        },
        lines,
        discount,
        charges,
        interstate: inter === "Y",
        agentId: agent?.id || "",
        payments: amount ? [{ method, amount, date: date + "T12:00:00" }] : [],
      };
      return {
        ref,
        rows: records.map((r) => r.row),
        input,
        total: totals.total,
        duplicateId: duplicate?.id,
        issues,
      };
    },
  );
  const seen = new Map<string, string>();
  for (const group of reviewed) {
    if (!group.input || group.issues.some((e) => !e.warning)) continue;
    const key = `${group.input.customer.phone}|${group.input.date?.slice(0, 10)}|${group.total}`;
    if (seen.has(key) && !group.duplicateId)
      group.issues.push({
        row: group.rows[0],
        column: "Invoice Ref",
        message: `Same mobile, date and total as Invoice Ref ${seen.get(key)} in this file. Skip / Overwrite also applies to this duplicate.`,
        warning: true,
      });
    else seen.set(key, group.ref);
  }
  return reviewed;
}
export type ImportUndo = {
  beforeInvoices: Invoice[];
  afterInvoices: Invoice[];
  beforeCustomers: Customer[];
  afterCustomers: Customer[];
};
export function applySalesImport(
  state: State,
  role: Role,
  groups: ImportGroup[],
  file: string,
  mode: "skip" | "overwrite",
) {
  requirePermission(state, role, "Sales Management", "create");
  requirePermission(state, role, "Billing POS", "create");
  if (mode === "overwrite")
    requirePermission(state, role, "Sales Management", "edit");
  let next = state,
    created = 0,
    skipped = 0,
    failed = 0;
  const errors: string[] = [],
    undo: ImportUndo = {
      beforeInvoices: [],
      afterInvoices: [],
      beforeCustomers: [],
      afterCustomers: [],
    };
  for (const group of groups) {
    if (group.issues.some((e) => !e.warning) || !group.input) {
      failed++;
      errors.push(
        `${group.ref}: ${group.issues
          .filter((e) => !e.warning)
          .map((e) => `Row ${e.row}, ${e.column}: ${e.message}`)
          .join("; ")}`,
      );
      continue;
    }
    const input = group.input;
    const duplicate =
      next.invoices.find((i) => i.externalId === group.ref) ||
      next.invoices.find(
        (i) =>
          i.customer.phone.replace(/\D/g, "").slice(-10) ===
            input.customer.phone &&
          i.date.slice(0, 10) === input.date?.slice(0, 10) &&
          i.total === group.total,
      );
    if (duplicate && mode === "skip") {
      skipped++;
      continue;
    }
    try {
      const beforeCustomer = next.customers.find(
        (c) => c.phone.replace(/\D/g, "").slice(-10) === input.customer.phone,
      );
      const normalized = {
        ...input,
        customer: {
          ...input.customer,
          phone: beforeCustomer?.phone || input.customer.phone,
        },
      };
      const base = duplicate
        ? {
            ...next,
            invoices: next.invoices.filter((i) => i.id !== duplicate.id),
          }
        : next;
      let candidate = createInvoice(base, role, normalized);
      const invoice = candidate.invoices.at(-1)!;
      // Preserve overwritten invoice numbers and avoid collisions when historical invoices were removed.
      let id = duplicate?.id || invoice.id;
      while (!duplicate && next.invoices.some((i) => i.id === id))
        id = `ADV-${String(Number(id.split("-").at(-1)) + 1).padStart(5, "0")}`;
      const result = { ...invoice, id };
      candidate = {
        ...candidate,
        invoices: [...candidate.invoices.slice(0, -1), result],
      };
      const originalInvoice =
        duplicate && state.invoices.find((i) => i.id === duplicate.id);
      if (
        originalInvoice &&
        !undo.beforeInvoices.some((i) => i.id === originalInvoice.id)
      )
        undo.beforeInvoices.push(originalInvoice);
      undo.afterInvoices = undo.afterInvoices.filter((i) => i.id !== result.id);
      undo.afterInvoices.push(result);
      if (
        beforeCustomer &&
        state.customers.some((c) => c.id === beforeCustomer.id) &&
        !undo.beforeCustomers.some((c) => c.id === beforeCustomer.id)
      )
        undo.beforeCustomers.push(
          state.customers.find((c) => c.id === beforeCustomer.id)!,
        );
      undo.afterCustomers = undo.afterCustomers.filter(
        (c) => c.id !== result.customer.id,
      );
      undo.afterCustomers.push(result.customer);
      next = candidate;
      created++;
    } catch (e) {
      failed++;
      errors.push(`${group.ref}: ${(e as Error).message}`);
    }
  }
  const batch = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    file,
    accepted: created,
    created,
    skipped,
    failed,
    user: role,
    errors,
    undo,
  };
  return { ...next, imports: [batch, ...next.imports] };
}
export function undoSalesImport(state: State, role: Role) {
  requirePermission(state, role, "Sales Management", "edit");
  const batch = state.imports[0];
  if (!batch?.undo || batch.undone)
    throw Error("Only the most recent import can be undone.");
  const undo = batch.undo;
  for (const i of undo.afterInvoices)
    if (
      JSON.stringify(state.invoices.find((x) => x.id === i.id)) !==
      JSON.stringify(i)
    )
      throw Error(
        "An imported invoice changed after import. Undo is blocked to preserve newer work.",
      );
  for (const c of undo.afterCustomers)
    if (
      JSON.stringify(state.customers.find((x) => x.id === c.id)) !==
      JSON.stringify(c)
    )
      throw Error(
        "An imported customer changed after import. Undo is blocked to preserve newer work.",
      );
  const affected = new Set(undo.afterInvoices.map((i) => i.id)),
    customers = new Set(undo.afterCustomers.map((c) => c.id));
  if (
    state.invoices.some(
      (i) =>
        !affected.has(i.id) &&
        customers.has(i.customer.id) &&
        !undo.beforeCustomers.some((c) => c.id === i.customer.id),
    )
  )
    throw Error("A newer invoice uses an imported customer. Undo is blocked.");
  return {
    ...state,
    invoices: [
      ...state.invoices.filter((i) => !affected.has(i.id)),
      ...undo.beforeInvoices,
    ],
    customers: [
      ...state.customers.filter((c) => !customers.has(c.id)),
      ...undo.beforeCustomers,
    ],
    imports: [
      { ...batch, undone: true, undo: undefined },
      ...state.imports.slice(1),
    ],
  };
}
export function errorReport(
  raw: Record<string, unknown>[],
  groups: ImportGroup[],
) {
  return raw.map((row, index) => ({
    ...row,
    Reason: groups
      .filter((g) => g.rows.includes(index + 2))
      .flatMap((g) =>
        g.issues.map(
          (e) =>
            `${e.warning ? "Warning" : "Error"} · Row ${e.row}, ${e.column}: ${e.message}`,
        ),
      )
      .join("; "),
  }));
}
