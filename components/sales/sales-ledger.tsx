"use client";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Download,
  CreditCard,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react";
import {
  Invoice,
  Role,
  State,
  money,
  visibleInvoices,
  paid,
  allowed,
} from "@/lib/model";
import {
  dateIN,
  kpiInfo,
  ledgerStatus,
  ledgerTotals,
  balance,
  agentName,
  defaultFilters,
  SalesFilters,
  filterSales,
  parseSalesFilters,
  previousSales,
  ageDays,
} from "@/lib/sales-ledger";
import { pluralize } from "@/lib/presentation";
import { exportSalesReport, reportBreakdowns } from "@/lib/sales-reports";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ImportSales } from "./import-sales";
import { undoSalesImport } from "@/lib/sales-import";
import { Dialog } from "@/components/ui/dialog";
export type LedgerProps = {
  state: State;
  role: Role;
  onState: (s: State) => void;
  onView: (i: Invoice) => void;
  onPdf: (i: Invoice) => void;
  onPayment: (i: Invoice) => void;
  onReminder: (i: Invoice) => void;
  notify: (message: string) => void;
  report?: boolean;
};
export function SalesLedger(props: LedgerProps) {
  return (
    <SalesLedgerBoundary>
      <SalesLedgerContent {...props} />
    </SalesLedgerBoundary>
  );
}
class SalesLedgerBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="card ledger-error" role="alert">
          <h2>Sales ledger could not load</h2>
          <p>
            Your saved invoices have not been changed. Try loading the ledger
            again.
          </p>
          <button
            className="btn secondary"
            onClick={() => this.setState({ failed: false })}
          >
            Retry ledger
          </button>
        </section>
      );
    return this.props.children;
  }
}
function SalesLedgerContent(props: LedgerProps) {
  const { state, role, onView, onPdf, onPayment, onReminder } = props;
  const [filters, setFilters] = useState<SalesFilters>(defaultFilters),
    [ready, setReady] = useState(false),
    [drawer, setDrawer] = useState(false),
    [size, setSize] = useState(25),
    [page, setPage] = useState(1),
    [density, setDensity] = useState("comfortable"),
    [sort, setSort] = useState("date"),
    [asc, setAsc] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [reminders, setReminders] = useState<Invoice[] | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [exportBusy, setExportBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setFilters(parseSalesFilters(location.search));
    const storedSize = Number(
      localStorage.getItem("adventure-sales-page-size"),
    );
    setSize([25, 50, 100].includes(storedSize) ? storedSize : 25);
    setDensity(
      localStorage.getItem("adventure-sales-density") || "comfortable",
    );
    setReady(true);
    const pop = () => {
      setFilters(parseSalesFilters(location.search));
      setPage(1);
      setSelected([]);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams(location.search);
    Object.entries(filters).forEach(([k, v]) => {
      p.delete("sales_" + k);
      if (
        Array.isArray(v)
          ? v.length
          : v !== defaultFilters[k as keyof SalesFilters]
      )
        p.set("sales_" + k, Array.isArray(v) ? v.join("|") : v);
    });
    window.history.replaceState(
      null,
      "",
      location.pathname + (p.size ? "?" + p : "") + location.hash,
    );
  }, [filters, ready]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !t.closest("input,textarea,select,[contenteditable],dialog")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, []);
  const invoices = useMemo(
    () =>
      props.report && allowed(state, role, "Reports")
        ? role === "Receptionist"
          ? state.invoices.filter((i) => i.createdBy === role)
          : state.invoices
        : visibleInvoices(state, role),
    [state, role, props.report],
  );
  const rows = useMemo(
    () => filterSales(invoices, filters),
    [invoices, filters],
  );
  const ageRows = useMemo(
    () => filterSales(invoices, { ...filters, age: "" }),
    [invoices, filters],
  );
  const totals = useMemo(() => ledgerTotals(rows), [rows]),
    prior = previousSales(invoices, filters),
    priorTotals = ledgerTotals(prior);
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const value = (i: Invoice) =>
          sort === "date"
            ? i.date
            : sort === "id"
              ? i.id
              : sort === "customer"
                ? i.customer.name
                : sort === "total"
                  ? i.total
                  : sort === "paid"
                    ? paid(i)
                    : sort === "balance"
                      ? balance(i)
                      : sort === "agent"
                        ? agentName(state, i.agentId)
                        : sort === "status"
                          ? ledgerStatus(i)
                          : i.lines.map((l) => l.name).join(", ");
        const x = value(a),
          y = value(b);
        return (
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "en-IN", { numeric: true })) *
          (asc ? 1 : -1)
        );
      }),
    [rows, sort, asc, state],
  );
  const pages = Math.max(1, Math.ceil(rows.length / size)),
    current = Math.min(page, pages),
    shown = sorted.slice((current - 1) * size, current * size),
    chosen = rows.filter((i) => selected.includes(i.id));
  const can = (action: "create" | "edit" | "export" | "print") =>
    allowed(
      state,
      role,
      props.report && action === "export" ? "Reports" : "Sales Management",
      action,
    );
  const breakdowns = useMemo(
    () => (props.report ? reportBreakdowns(state, rows, role, filters) : null),
    [props.report, state, rows, role, filters],
  );
  async function exportFile(format: "xlsx" | "csv" | "pdf") {
    if (!can("export")) return;
    setExportBusy(true);
    setError("");
    try {
      const list = chosen.length ? chosen : rows;
      await exportSalesReport(format, state, list, role, filters);
      props.onState({
        ...state,
        audit: [
          {
            date: new Date().toISOString(),
            user: role,
            action: "Export sales",
            detail: `${format}: ${list.length} invoices`,
          },
          ...(state.audit || []),
        ],
      });
      props.notify(`Exported ${list.length} invoices.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportBusy(false);
    }
  }
  const change = (next: Partial<SalesFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
    setSelected([]);
  };
  const toggle = (
    key: "status" | "payment" | "agent" | "activity",
    value: string,
  ) =>
    change({
      [key]: filters[key].includes(value)
        ? filters[key].filter((v) => v !== value)
        : [...filters[key], value],
    });
  const doSort = (key: string) => {
    setSort(key);
    setAsc(sort === key ? !asc : true);
  };
  const controls = (
    <div className="ledger-filter-fields">
      {(
        [
          [
            "status",
            "Status",
            ["Paid", "Unpaid", "Partial", "Cancelled", "Refunded"].map((v) => [
              v,
              v,
            ]),
          ],
          [
            "payment",
            "Payment mode",
            ["Cash", "UPI", "Card", "Bank Transfer"].map((v) => [v, v]),
          ],
          [
            "agent",
            "Agent",
            [["direct", "Direct"], ...state.agents.map((a) => [a.id, a.name])],
          ],
          ["activity", "Activity", state.services.map((s) => [s.id, s.name])],
        ] as ["status" | "payment" | "agent" | "activity", string, string[][]][]
      ).map(([key, label, options]) => (
        <details key={key}>
          <summary>
            {label}
            {filters[key].length ? ` (${filters[key].length})` : ""}
          </summary>
          <div className="ledger-options">
            {options.map(([value, name]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={filters[key].includes(value)}
                  onChange={() => toggle(key, value)}
                />
                {name}
              </label>
            ))}
          </div>
        </details>
      ))}
      <label>
        Minimum amount
        <input
          type="number"
          min="0"
          value={filters.min}
          onChange={(e) => change({ min: e.target.value })}
        />
      </label>
      <label>
        Maximum amount
        <input
          type="number"
          min="0"
          value={filters.max}
          onChange={(e) => change({ max: e.target.value })}
        />
      </label>
    </div>
  );
  if (!ready)
    return (
      <div
        className="ledger-loading"
        role="status"
        aria-label="Loading sales ledger"
      >
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton" />
        ))}
        <section
          className="ledger-loading-table"
          aria-label="Loading invoice table"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div className="skeleton" key={index} />
          ))}
        </section>
        Loading sales ledger…
      </div>
    );
  return (
    <div className={`sales-ledger ledger-${density}`}>
      <div className="ledger-toolbar">
        <span>{props.report ? "Sales report" : "Sales ledger"}</span>
        {can("export") && (
          <details className="ledger-export">
            <summary>Export {chosen.length ? "selected" : ""}</summary>
            <div>
              {(["xlsx", "csv", "pdf"] as const).map((format) => (
                <button
                  className="btn secondary"
                  key={format}
                  disabled={exportBusy}
                  onClick={() => exportFile(format)}
                >
                  {format === "xlsx" ? "Excel (.xlsx)" : format.toUpperCase()}
                </button>
              ))}
            </div>
          </details>
        )}
        {can("create") && allowed(state, role, "Billing POS", "create") && (
          <button className="btn secondary" onClick={() => setImportOpen(true)}>
            Import sales
          </button>
        )}
      </div>
      {importOpen && (
        <ImportSales
          state={state}
          role={role}
          onState={props.onState}
          onClose={() => setImportOpen(false)}
          notify={props.notify}
        />
      )}
      <div className="ledger-kpis">
        {Object.entries(kpiInfo).map(([key, [title, info]]) => {
          const val = totals[key as keyof typeof totals],
            prev = priorTotals[key as keyof typeof priorTotals];
          return (
            <button
              key={key}
              className="card ledger-kpi"
              aria-pressed={filters.metric === key}
              onClick={() => change({ metric: key })}
            >
              <span>
                {title}
                <span
                  className="ledger-info"
                  title={info}
                  aria-label={info}
                  tabIndex={0}
                >
                  ⓘ<span role="tooltip">{info}</span>
                </span>
              </span>
              <strong>{key === "count" ? val : money(val)}</strong>
              {prior.length > 0 && (
                <small>
                  {prev
                    ? `${(((val - prev) / prev) * 100).toFixed(1)}%`
                    : `${key === "count" ? val : money(val)} increase`}{" "}
                  vs previous period
                </small>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="ledger-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <section className="card ledger-controls">
        <div className="ledger-toolbar">
          <label className="ledger-search">
            Search invoices
            <input
              ref={searchRef}
              type="search"
              placeholder="Invoice no, customer or mobile"
              value={filters.q}
              onChange={(e) => change({ q: e.target.value })}
            />
          </label>
          <label>
            Saved views
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                setFilters({
                  ...defaultFilters,
                  ...(v === "unpaid"
                    ? { status: ["Unpaid"], period: "month" }
                    : v === "partial"
                      ? { status: ["Partial"], period: "all" }
                      : v === "refunds"
                        ? { status: ["Refunded"], period: "all" }
                        : v === "agents"
                          ? {
                              agent: state.agents.map((a) => a.id),
                              period: "all",
                            }
                          : {}),
                });
                setSelected([]);
                setPage(1);
              }}
            >
              <option value="">Choose a view</option>
              <option value="unpaid">Unpaid this month</option>
              <option value="partial">Partial payments</option>
              <option value="refunds">Refunds</option>
              <option value="agents">Agent sales</option>
            </select>
          </label>
          <button
            className="btn secondary ledger-filter-trigger"
            onClick={() => setDrawer(true)}
          >
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
        <div className="ledger-periods" aria-label="Sales period">
          {[
            ["today", "Today"],
            ["week", "This week"],
            ["month", "This month"],
            ["year", "This year"],
            ["financial", "Financial year"],
            ["all", "All time"],
          ].map(([v, label]) => (
            <button
              key={v}
              aria-pressed={filters.period === v}
              onClick={() => change({ period: v, from: "", to: "" })}
            >
              {label}
            </button>
          ))}
          <details className="ledger-custom">
            <summary>Custom range</summary>
            <div>
              <label>
                From
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) =>
                    change({ period: "custom", from: e.target.value })
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  min={filters.from}
                  value={filters.to}
                  onChange={(e) =>
                    change({ period: "custom", to: e.target.value })
                  }
                />
              </label>
            </div>
          </details>
        </div>
        <div className="ledger-desktop-filters">{controls}</div>
        <div className="ledger-active" aria-label="Active filters">
          {Object.entries(filters).flatMap(([key, value]) => {
            if (
              value === defaultFilters[key as keyof SalesFilters] ||
              !value ||
              (Array.isArray(value) && !value.length)
            )
              return [];
            return (Array.isArray(value) ? value : [value]).map((v) => (
              <button
                key={key + v}
                onClick={() =>
                  change({
                    [key]: Array.isArray(value)
                      ? value.filter((x) => x !== v)
                      : defaultFilters[key as keyof SalesFilters],
                  })
                }
              >
                {
                  (
                    {
                      period: "Period",
                      from: "From",
                      to: "To",
                      status: "Status",
                      payment: "Payment",
                      agent: "Agent",
                      activity: "Activity",
                      min: "Minimum amount",
                      max: "Maximum amount",
                      q: "Search",
                      metric: "View",
                      age: "Outstanding age",
                    } as Record<string, string>
                  )[key]
                }
                :{" "}
                {key === "agent"
                  ? agentName(state, v)
                  : key === "activity"
                    ? state.services.find((s) => s.id === v)?.name || v
                    : key === "period"
                      ? (
                          {
                            today: "Today",
                            week: "This week",
                            month: "This month",
                            year: "This year",
                            financial: "Financial year",
                            custom: "Custom range",
                            all: "All time",
                          } as Record<string, string>
                        )[v] || v
                      : key === "metric"
                        ? kpiInfo[v as keyof typeof kpiInfo]?.[0] || v
                        : key === "from" || key === "to"
                          ? dateIN(v)
                          : key === "min" || key === "max"
                            ? money(Number(v))
                            : key === "age"
                              ? v + " days"
                              : v}{" "}
                ×
              </button>
            ));
          })}
          <button
            className="link"
            onClick={() => {
              setFilters({ ...defaultFilters, period: "all" });
              setSelected([]);
              setPage(1);
            }}
          >
            Clear all
          </button>
        </div>
      </section>
      {drawer && (
        <Dialog title="Sales filters" onClose={() => setDrawer(false)}>
          {controls}
          <button className="btn" onClick={() => setDrawer(false)}>
            Show {pluralize(rows.length, "invoice")}
          </button>
        </Dialog>
      )}
      {breakdowns && (
        <section className="ledger-report">
          <section className="card">
            <h2>Sales vs collections</h2>
            <p>
              Sales by invoice date, collections by payment date, within this
              period for the filtered invoice cohort.
            </p>
            <div
              className="ledger-trend"
              role="img"
              aria-label="Sales versus collections trend"
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={breakdowns.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Date" tickFormatter={dateIN} />
                  <YAxis width={80} />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    labelFormatter={(label) => dateIN(String(label))}
                    itemStyle={{ color: "#475569" }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "#475569" }}>{value}</span>
                    )}
                  />
                  <Line dataKey="Sales" stroke="#0f9d8a" dot={false} />
                  <Line dataKey="Collections" stroke="#f59e0b" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details>
              <summary>Trend data</summary>
              <div
                className="table-wrap"
                tabIndex={0}
                aria-label="Report data table"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sales</th>
                      <th>Collections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdowns.trend.map((r) => (
                      <tr key={r.Date}>
                        <td>{dateIN(r.Date)}</td>
                        <td>{money(r.Sales)}</td>
                        <td>{money(r.Collections)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          {(
            ["activity", "payments", "agents", "outstanding", "gst"] as const
          ).map((key) => (
            <section key={key} className="card">
              <h2>
                {
                  {
                    activity: "By activity",
                    payments: "By payment mode",
                    agents: "By agent",
                    outstanding: "Outstanding invoices",
                    gst: "GST summary",
                  }[key]
                }
              </h2>
              <div
                className="table-wrap"
                tabIndex={0}
                aria-label="Report data table"
              >
                <table>
                  <thead>
                    <tr>
                      {Object.keys(breakdowns[key][0] || {}).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {breakdowns[key].slice(0, 100).map((row, index) => (
                      <tr key={index}>
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k}>
                            {typeof v === "number"
                              ? ["Participants", "Bookings"].includes(k)
                                ? v
                                : money(v)
                              : v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {breakdowns[key].length > 100 && (
                <p>Showing 100 rows. Export for the complete list.</p>
              )}
              {!breakdowns[key].length && <p>No matching data.</p>}
            </section>
          ))}
        </section>
      )}
      <section className="card ledger-ageing" aria-label="Outstanding by age">
        <div>
          <h2>Outstanding by age</h2>
          <small>Age from invoice date · current filters</small>
        </div>
        {[
          ["0-7", "0–7 days"],
          ["8-30", "8–30 days"],
          ["31+", "31+ days"],
        ].map(([key, label]) => {
          const group = ageRows.filter(
            (i) =>
              balance(i) > 0 &&
              (key === "0-7"
                ? ageDays(i) <= 7
                : key === "8-30"
                  ? ageDays(i) >= 8 && ageDays(i) <= 30
                  : ageDays(i) >= 31),
          );
          return (
            <button
              key={key}
              aria-pressed={filters.age === key}
              onClick={() => change({ age: filters.age === key ? "" : key })}
            >
              <span>{label}</span>
              <strong>
                {money(group.reduce((s, i) => s + balance(i), 0))}
              </strong>
              <small>{pluralize(group.length, "invoice")}</small>
            </button>
          );
        })}
        {can("edit") && (
          <button
            className="btn secondary"
            disabled={!rows.some((i) => balance(i) > 0)}
            onClick={() => setReminders(rows.filter((i) => balance(i) > 0))}
          >
            Send reminders
          </button>
        )}
      </section>
      {reminders && (
        <Dialog title="Send reminders" onClose={() => setReminders(null)}>
          <p>
            Review each reminder before sharing. Nothing is sent automatically.
          </p>
          <div className="ledger-reminder-list">
            {reminders.map((i) => (
              <div key={i.id}>
                <span>
                  {i.id} · {i.customer.name} · {money(balance(i))}
                </span>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setReminders(null);
                    onReminder(i);
                  }}
                >
                  Review reminder
                </button>
              </div>
            ))}
          </div>
        </Dialog>
      )}
      <section className="card ledger-table-card">
        <div className="ledger-toolbar">
          <h2>{pluralize(rows.length, "invoice")}</h2>
          <label>
            Density
            <select
              value={density}
              onChange={(e) => {
                setDensity(e.target.value);
                localStorage.setItem("adventure-sales-density", e.target.value);
              }}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </div>
        {selected.length > 0 && (
          <div className="ledger-bulk" role="status">
            {pluralize(chosen.length, "invoice")} selected{" "}
            {can("export") && (
              <button disabled={exportBusy} onClick={() => exportFile("xlsx")}>
                Export selected
              </button>
            )}{" "}
            {can("edit") && (
              <button
                onClick={() =>
                  setReminders(chosen.filter((i) => balance(i) > 0))
                }
              >
                Send reminders
              </button>
            )}{" "}
            <button onClick={() => setSelected([])}>Clear selection</button>
          </div>
        )}
        <div
          className="table-wrap ledger-table-scroll"
          tabIndex={0}
          aria-label="Sales invoice table"
        >
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select this page"
                    checked={
                      shown.length > 0 &&
                      shown.every((i) => selected.includes(i.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? Array.from(
                              new Set([...selected, ...shown.map((i) => i.id)]),
                            )
                          : selected.filter(
                              (id) => !shown.some((i) => i.id === id),
                            ),
                      )
                    }
                  />
                </th>
                {[
                  ["date", "Invoice & date"],
                  ["customer", "Customer"],
                  ["activity", "Activity"],
                  ["total", "Total"],
                  ["paid", "Paid"],
                  ["balance", "Balance"],
                  ["agent", "Agent"],
                  ["status", "Status"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    aria-sort={
                      sort === key ? (asc ? "ascending" : "descending") : "none"
                    }
                  >
                    <button onClick={() => doSort(key)}>
                      {label}
                      {sort === key ? (asc ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr
                  key={i.id}
                  tabIndex={0}
                  aria-label={`Open invoice ${i.id}`}
                  onClick={() => can("print") && onView(i)}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      if (can("print")) onView(i);
                    }
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${i.id}`}
                      checked={selected.includes(i.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, i.id]
                            : selected.filter((id) => id !== i.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <b>{i.id}</b>
                    {i.customerBookingId && (
                      <small className="booking-source">
                        Booked by customer
                      </small>
                    )}
                    <small>{dateIN(i.date)}</small>
                    {i.externalId && <small>{i.externalId}</small>}
                  </td>
                  <td>
                    {i.customer.name}
                    <small>{i.customer.phone}</small>
                  </td>
                  <td>
                    {i.lines.map((l) => l.name).join(", ")}
                    <small>
                      {pluralize(
                        i.lines.reduce((s, l) => s + l.qty, 0),
                        "participant",
                      )}
                    </small>
                  </td>
                  <td className="number">{money(i.total)}</td>
                  <td className="number">{money(paid(i))}</td>
                  <td className="number">{money(balance(i))}</td>
                  <td>
                    {agentName(state, i.agentId)}
                    {allowed(state, role, "Agents & Commissions") && (
                      <small>
                        Commission{" "}
                        {money(i.status === "Active" ? i.commission : 0)}
                      </small>
                    )}
                  </td>
                  <td>
                    <span
                      className={`ledger-status ledger-status-${ledgerStatus(i).toLowerCase()}`}
                    >
                      {ledgerStatus(i)}
                    </span>
                    {i.status === "Refunded" && (
                      <small>
                        {money(paid(i))} refunded ·{" "}
                        {i.refundReason ||
                          "Reason not recorded (legacy invoice)"}
                      </small>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="ledger-row-actions">
                      {can("print") && (
                        <>
                          <button
                            className="icon-button"
                            title="View"
                            aria-label={`View ${i.id}`}
                            onClick={() => onView(i)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="icon-button"
                            title="Download PDF"
                            aria-label={`Download PDF for ${i.id}`}
                            onClick={() => onPdf(i)}
                          >
                            <Download size={16} />
                          </button>
                        </>
                      )}
                      {can("edit") && balance(i) > 0 && (
                        <>
                          <button
                            className="icon-button"
                            title="Record payment"
                            aria-label={`Record payment for ${i.id}`}
                            onClick={() => onPayment(i)}
                          >
                            <CreditCard size={16} />
                          </button>
                          <button
                            className="icon-button"
                            title="Send reminder"
                            aria-label={`Send reminder for ${i.id}`}
                            onClick={() => onReminder(i)}
                          >
                            <MessageCircle size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Filtered totals · {rows.length}</th>
                <td className="number">
                  {money(rows.reduce((s, i) => s + i.total, 0))}
                </td>
                <td className="number">
                  {money(rows.reduce((s, i) => s + paid(i), 0))}
                </td>
                <td className="number">{money(totals.outstanding)}</td>
                <td colSpan={3}>Includes original reversed invoice totals</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!rows.length && (
          <div className="ledger-empty">
            <h3>No invoices match these filters</h3>
            <p>Try another period or clear your filters.</p>
          </div>
        )}
        <div className="ledger-pagination">
          <label>
            Rows per page
            <select
              value={size}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSize(n);
                setPage(1);
                localStorage.setItem("adventure-sales-page-size", String(n));
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <span>
            Page {current} of {pages} · {rows.length} results
          </span>
          <button
            className="btn secondary"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <button
            className="btn secondary"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      </section>
      {can("create") && state.imports.length > 0 && (
        <section className="card ledger-import-history">
          <h2>Import history</h2>
          {state.imports.slice(0, 25).map((batch, index) => (
            <details key={batch.id || index}>
              <summary>
                {batch.file} · {dateIN(batch.date)} ·{" "}
                {batch.user || "Legacy user"} · {batch.accepted} created /
                overwritten · {batch.skipped || 0} skipped ·{" "}
                {batch.failed ?? batch.errors.length} failed
                {batch.undone ? " · Undone" : ""}
              </summary>
              {batch.errors.map((error, n) => (
                <p className="error" key={n}>
                  {error}
                </p>
              ))}
              {index === 0 && batch.undo && !batch.undone && can("edit") && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    try {
                      const next = undoSalesImport(state, role);
                      props.onState({
                        ...next,
                        audit: [
                          {
                            date: new Date().toISOString(),
                            user: role,
                            action: "Undo import",
                            detail: batch.file,
                          },
                          ...(next.audit || []),
                        ],
                      });
                      props.notify("Most recent import undone.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Undo most recent import
                </button>
              )}
            </details>
          ))}
        </section>
      )}
      <p className="muted">
        Sales exclude cancelled and refunded invoices. Original invoice records
        remain available in the ledger.
      </p>
    </div>
  );
}
