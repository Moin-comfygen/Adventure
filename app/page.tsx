"use client";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  Receipt,
  CreditCard,
  MessageCircle,
  TrendingUp,
  Users,
  Palette,
  Contact,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  Mountain,
  Search,
  Plus,
  ArrowUpRight,
  Bell,
  Download,
  Printer,
  Check,
  Menu,
  LogOut,
  Wallet,
  ArrowRight,
  GripVertical,
  Undo2,
  Redo2,
  X,
  HelpCircle,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  State,
  Role,
  Module,
  Customer,
  Invoice,
  Agent,
  Template,
  Section,
  Action,
  modules,
  actions,
  seed,
  money,
  round,
  createInvoice,
  allowed,
  requirePermission,
  visibleInvoices,
  paid,
  earned,
  settled,
} from "@/lib/model";
import { spreadsheet, pdf, invoicePdf } from "@/lib/documents";
import { inPeriod } from "@/lib/analytics";
import { InvoiceStatus } from "@/components/invoice-status";
import { DateRangePicker } from "@/components/date-range-picker";
import { pluralize, initials, showDemoLabels } from "@/lib/presentation";
import { Overview, PeriodTabs } from "@/components/dashboard/overview";
import { periodBounds } from "@/lib/dashboard-presentation";
import { useBookingReceipts } from "@/hooks/use-booking-receipts";
import { BookingManager } from "@/components/bookings/booking-manager";
import { InvoiceWhatsApp } from "@/components/invoice-whatsapp";
import { InvoiceReminder } from "@/components/invoice-reminder";
import {
  CommandPalette,
  type CommandItem,
} from "@/components/workspace/command-palette";
import { Dialog } from "@/components/ui/dialog";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";
import { SalesLedger } from "@/components/sales/sales-ledger";
import { BillingPos } from "@/components/billing/billing-pos";
import {
  addDemoServiceImages,
  correctDemoCategories,
} from "@/lib/service-catalog";
import { ServiceThumbnail } from "@/components/services/service-thumbnail";
import { ServiceImageUpload } from "@/components/services/service-image-upload";
import type { ServiceImages } from "@/lib/service-images";
const icons = [
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Users,
  Palette,
  Contact,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  CalendarDays,
];
function SortableBlock({
  section,
  children,
  onSelect,
}: {
  section: Section;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: section.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: section.spacing,
        fontSize: section.font,
        color: section.color,
        textAlign: section.align,
        width: `${section.width}%`,
        border: section.border ? "1px solid #cbd5e1" : undefined,
      }}
      className="design-block"
      onClick={onSelect}
    >
      <button
        className="grip"
        {...attributes}
        {...listeners}
        aria-label={`Move ${section.label}`}
      >
        <GripVertical size={15} />
      </button>
      {children}
    </div>
  );
}
export default function Home() {
  const [s, setS] = useState<State | null>(null);
  const [role, setRole] = useState<Role>("Super Admin");
  const [logged, setLogged] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [page, setPage] = useState<Module>("Dashboard");
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [appInfo, setAppInfo] = useState<"help" | "news" | null>(null);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const billingPreviewFocusRef = useRef(false);
  const [modal, setModal] = useState<Invoice | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
  const [bookingToCollect, setBookingToCollect] = useState("");
  const [shareRequest, setShareRequest] = useState<{
    id: string;
    message?: string;
  } | null>(null);
  const [pdfRequest, setPdfRequest] = useState<string | null>(null);
  const [format, setFormat] = useState<"A4" | "Thermal">("A4");
  const [agentEdit, setAgentEdit] = useState<Agent | null>(null);
  const [agentView, setAgentView] = useState("");
  const [payout, setPayout] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [adjustment, setAdjustment] = useState(false);
  const [newServiceImages, setNewServiceImages] = useState<ServiceImages>({});
  const [newServiceImageBusy, setNewServiceImageBusy] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [billingDirty, setBillingDirty] = useState(false);
  const [billingCustomer, setBillingCustomer] = useState<Customer | null>(null);
  const [report, setReport] = useState("Sales report");
  const [templateIndex, setTemplateIndex] = useState(0);
  const [draft, setDraft] = useState<Template | null>(null);
  const [selected, setSelected] = useState("b0");
  const [history, setHistory] = useState<Template[]>([]);
  const [redo, setRedo] = useState<Template[]>([]);
  useBookingReceipts(
    logged,
    role + ":" + page,
    syncBookingReceipts,
    syncBookingBranding,
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adventure-suite-v1");
      const initial: State = saved ? JSON.parse(saved) : seed();
      initial.services = addDemoServiceImages(
        correctDemoCategories(initial.services),
      );
      setS(initial);
      setCollapsed(
        localStorage.getItem("adventure-sidebar-collapsed") === "true",
      );
      setReadNotifications(
        JSON.parse(
          localStorage.getItem("adventure-read-notifications") || "[]",
        ),
      );
      const r = sessionStorage.getItem("adventure-role") as Role | null;
      if (r) {
        setRole(r);
        setLogged(true);
        const previousPage = sessionStorage.getItem(
          "adventure-last-page",
        ) as Module | null;
        setPage(
          previousPage &&
            modules.includes(previousPage) &&
            allowed(initial, r, previousPage)
            ? previousPage
            : allowed(initial, r, "Dashboard")
              ? "Dashboard"
              : "Billing POS",
        );
      }
    } catch (error) {
      console.error("Data initialization failed", error);
      setToast(
        "Saved data could not be loaded. Export a backup before resetting.",
      );
    }
  }, []);
  useEffect(() => {
    if (s) {
      try {
        localStorage.setItem("adventure-suite-v1", JSON.stringify(s));
      } catch {
        setToast(
          "Browser storage is full or unavailable. Download a backup in Settings.",
        );
      }
    }
  }, [s]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!pdfRequest || modal?.id !== pdfRequest) return;
    const element = document.getElementById("print-invoice");
    if (!element) return;
    setPdfRequest(null);
    invoicePdf(element, modal.id, false).catch((error) =>
      setToast("PDF generation failed: " + error.message),
    );
  }, [pdfRequest, modal]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        logged &&
        page !== "Billing POS" &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setMobile(false);
        setCommandOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [logged, page]);
  useEffect(() => {
    if (!mobile) return;
    const returnTo = document.activeElement as HTMLElement;
    const sidebar = document.getElementById("workspace-navigation");
    const items = Array.from(
      sidebar?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ||
        [],
    ).filter((el) => el.getClientRects().length > 0);
    items[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key === "Tab") {
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && index === items.length - 1) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = overflow;
      if (returnTo?.isConnected && returnTo !== document.body) returnTo.focus();
      else document.getElementById("customer-phone")?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    if (!modal && !agentView && !agentEdit) return;
    const container = Array.from(
      document.querySelectorAll<HTMLElement>(".overlay .dialog"),
    ).at(-1);
    if (!container) return;
    const returnToBilling = billingPreviewFocusRef.current;
    billingPreviewFocusRef.current = false;
    const returnTo = document.activeElement as HTMLElement;
    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setModal(null);
        setShareRequest(null);
        setAgentView("");
        setAgentEdit(null);
      }
      if (event.key === "Tab") {
        const items = focusable();
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && index === items.length - 1) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      if (returnToBilling) document.getElementById("customer-phone")?.focus();
      else if (returnTo?.isConnected && returnTo !== document.body)
        returnTo.focus();
      else document.getElementById("customer-phone")?.focus();
    };
  }, [modal?.id, agentView, !!agentEdit]);
  const notify = (text: string) => setToast(text);
  function run(fn: () => void) {
    try {
      fn();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Something went wrong");
    }
  }
  if (!s)
    return toast ? (
      <div role="alert" className="loading">
        {toast}
      </div>
    ) : (
      <DashboardSkeleton />
    );
  const state = s;
  const invoiceState = modal?.businessSnapshot
    ? {
        ...state,
        business: modal.businessSnapshot,
        services: modal.customerBookingId
          ? state.bookingBranding?.services || state.services
          : state.services,
      }
    : state;
  const invoiceTemplate =
    (modal?.customerBookingId ? state.bookingBranding?.template : undefined) ||
    state.templates[state.defaultTemplate];
  const can = (m: Module, a: Action = "view") => allowed(state, role, m, a);
  const invoices = can("Sales Management") ? visibleInvoices(state, role) : [];
  const active = invoices.filter((i) => i.status === "Active");
  const matchesPeriod = (date: string) => inPeriod(date, range, from, to);
  const scoped = active.filter((i) => matchesPeriod(i.date));
  const reportInvoices = active.filter((i) =>
    inPeriod(i.date, "all", from, to),
  );
  const reportData = reportRows(
    state,
    report === "Payment Collection Report"
      ? active
      : report === "Agent Ledger Report"
        ? invoices.filter((i) => inPeriod(i.date, "all", from, to))
        : reportInvoices,
    report,
  ).filter((row) =>
    report === "Payment Collection Report" || report === "Excel Import Report"
      ? inPeriod(String(row.Date), "all", from, to)
      : true,
  );
  const revenue = (list: Invoice[]) =>
    round(list.reduce((a, i) => a + i.base + i.charges, 0));
  function navigate(m: Module) {
    if (!can(m)) return notify("Access restricted for this role.");
    if (
      page === "Billing POS" &&
      m !== "Billing POS" &&
      billingDirty &&
      !window.confirm(
        "Leave this unsaved bill? Its draft will be kept in this browser.",
      )
    )
      return;
    sessionStorage.setItem("adventure-last-page", m);
    setPage(m);
    setSearch("");
    setMobile(false);
  }
  async function switchRole(r: Role) {
    if (
      page === "Billing POS" &&
      billingDirty &&
      !window.confirm(
        "Switch roles and leave this unsaved bill? Its draft will be kept for this role.",
      )
    )
      return;
    setSwitchingRole(true);
    try {
      const response = await fetch("/api/booking-staff/session", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Booking session could not be closed");
    } catch {
      setSwitchingRole(false);
      notify("Could not lock the booking queue. Please retry changing roles.");
      return;
    }
    setRole(r);
    setSwitchingRole(false);
    sessionStorage.setItem("adventure-role", r);
    setLogged(true);
    const nextPage = allowed(state, r, "Dashboard")
      ? "Dashboard"
      : "Billing POS";
    setPage(nextPage);
    sessionStorage.setItem("adventure-last-page", nextPage);
    setModal(null);
    setShareRequest(null);
    setAgentView("");
    setReminderInvoice(null);
    setPdfRequest(null);
    setCommandOpen(false);
    setNotificationsOpen(false);
  }
  function persistServiceCatalog(next: State) {
    try {
      localStorage.setItem("adventure-suite-v1", JSON.stringify(next));
    } catch {
      throw Error(
        "Browser storage is full or unavailable. Download a backup and free browser storage before saving more data.",
      );
    }
    setS(next);
  }
  function openInvoice(i: Invoice) {
    requirePermission(state, role, "Sales Management", "print");
    if (
      role === "Receptionist" &&
      i.createdBy !== role &&
      !(i.customerBookingId && page === "Customer Bookings")
    )
      throw Error("Invoice outside permitted history.");
    setModal(i);
    setShareRequest(null);
  }
  function shareInvoice(invoice: Invoice, message?: string) {
    requirePermission(state, role, "Sales Management", "print");
    const currentInvoice =
      state.invoices.find((item) => item.id === invoice.id) || invoice;
    openInvoice(currentInvoice);
    setFormat("A4");
    setShareRequest({ id: currentInvoice.id, message });
  }
  function recordPayment(invoice: Invoice) {
    if (invoice.customerBookingId) {
      setModal(null);
      setShareRequest(null);
      setBookingToCollect(invoice.customerBookingId);
      navigate("Customer Bookings");
      return;
    }
    openInvoice(invoice);
    setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(
            '.invoice-operations input[name="amount"]',
          )
          ?.focus(),
      100,
    );
  }
  function syncBookingBranding(
    branding: NonNullable<State["bookingBranding"]>,
  ) {
    setS((current) =>
      current &&
      JSON.stringify(current.bookingBranding) !== JSON.stringify(branding)
        ? { ...current, bookingBranding: branding }
        : current,
    );
  }
  function syncBookingReceipts(invoices: Invoice[]) {
    setS((current) => {
      if (!current) return current;
      let changed = false;
      const next = {
        ...current,
        invoices: [...current.invoices],
        customers: [...current.customers],
      };
      for (const remote of invoices) {
        const customer = next.customers.find(
          (c) =>
            c.phone.replace(/\D/g, "").slice(-10) ===
            remote.customer.phone.replace(/\D/g, "").slice(-10),
        );
        const invoice = {
          ...remote,
          customer: {
            ...remote.customer,
            id: customer?.id || remote.customer.id,
          },
        };
        const index = next.invoices.findIndex(
          (i) => i.id === invoice.id || i.externalId === invoice.externalId,
        );
        if (
          index >= 0 &&
          (next.invoices[index].customerBookingVersion || 0) >
            (invoice.customerBookingVersion || 0)
        )
          continue;
        if (index < 0) {
          next.invoices.push(invoice);
          changed = true;
        } else if (
          JSON.stringify(next.invoices[index]) !== JSON.stringify(invoice)
        ) {
          next.invoices[index] = invoice;
          changed = true;
        }
        const customerIndex = next.customers.findIndex(
          (c) => c.id === invoice.customer.id,
        );
        if (customerIndex < 0) {
          next.customers.push(invoice.customer);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }
  const selectedAgent = state.agents.find((a) => a.id === agentView);
  const design = draft || state.templates[templateIndex];
  function updateDesign(next: Template) {
    requirePermission(state, role, "Invoice Designer", "edit");
    setHistory([...history, structuredClone(design)]);
    setRedo([]);
    setDraft(next);
  }
  const pendingInvoices = invoices.filter(
    (i) => i.status === "Active" && paid(i) < i.total,
  );
  const notifications = [
    ...pendingInvoices.map((i) => ({
      id: `balance:${i.id}:${round(i.total - paid(i))}`,
      title: `${i.id} · Payment pending`,
      detail: `${i.customer.name} · ${money(i.total - paid(i))} due`,
      onSelect: () => run(() => openInvoice(i)),
    })),
    ...(can("Sales Management", "create")
      ? state.imports
          .filter((batch) => batch.errors.length > 0)
          .map((batch) => ({
            id: `import:${batch.date}`,
            title: `${batch.file} · Import needs review`,
            detail: pluralize(batch.errors.length, "row error"),
            onSelect: () => navigate("Sales Management"),
          }))
      : []),
  ];
  const unread = notifications.filter(
    (item) => !readNotifications.includes(item.id),
  ).length;
  function markRead(ids: string[]) {
    const next = Array.from(new Set([...readNotifications, ...ids]));
    setReadNotifications(next);
    try {
      localStorage.setItem(
        "adventure-read-notifications",
        JSON.stringify(next),
      );
    } catch {
      notify("Notification preferences could not be saved.");
    }
  }
  const commandItems: CommandItem[] = [
    ...modules
      .filter((m) => can(m))
      .map((m) => ({
        id: `page:${m}`,
        label: m,
        detail: "Open page",
        group: "Pages",
        onSelect: () => navigate(m),
      })),
    ...(can("Sales Management", "print")
      ? invoices.map((i) => ({
          id: `invoice:${i.id}`,
          label: i.id,
          detail: `${i.customer.name} · ${i.customer.phone}`,
          group: "Invoices",
          onSelect: () => run(() => openInvoice(i)),
        }))
      : []),
    ...(can("Customers")
      ? state.customers.map((c) => ({
          id: `customer:${c.id}`,
          label: c.name,
          detail: c.phone,
          group: "Customers",
          onSelect: () => {
            navigate("Customers");
            setSearch(c.phone);
          },
        }))
      : []),
    ...(can("Agents & Commissions")
      ? state.agents.map((a) => ({
          id: `agent:${a.id}`,
          label: a.name,
          detail: a.phone,
          group: "Agents",
          onSelect: () => {
            navigate("Agents & Commissions");
            setAgentView(a.id);
          },
        }))
      : []),
  ];
  const stat = (
    label: string,
    value: string,
    detail: string,
    Icon = Wallet,
  ) => (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
  const dateFilters = (
    <DateRangePicker
      from={from}
      to={to}
      onChange={(start, end) => {
        setFrom(start);
        setTo(end);
      }}
    />
  );
  const salesTable = (list: Invoice[], compact = false) => (
    <div
      className="table-wrap invoice-table-scroll"
      tabIndex={0}
      role="region"
      aria-label={
        compact
          ? "Recent invoices, scroll horizontally for all columns"
          : "Sales invoices, scroll horizontally for all columns"
      }
    >
      <table className="sales-invoices">
        <thead>
          <tr>
            <th>Invoice / Date</th>
            <th>Customer</th>
            <th>Adventure activity</th>
            <th>Total</th>
            <th>Payment</th>
            {!compact && <th>Balance</th>}
            {role !== "Receptionist" && !compact && <th>Agent / Commission</th>}
            <th>Status</th>
            <th>
              <span className="sr-only">Invoice actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((i) => (
            <tr
              key={i.id}
              tabIndex={0}
              aria-label={`Open invoice ${i.id} for ${i.customer.name}`}
              className="invoice-row"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button,a,input")) return;
                run(() => openInvoice(i));
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  run(() => openInvoice(i));
                }
              }}
            >
              <td>
                <button
                  className="link"
                  onClick={() => run(() => openInvoice(i))}
                >
                  {i.id}
                </button>
                <small>
                  {new Date(i.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </small>
              </td>
              <td>
                <div className="person">
                  <span className="avatar">{initials(i.customer.name)}</span>
                  <div>
                    {i.customer.name}
                    <small>{i.customer.phone}</small>
                  </div>
                </div>
              </td>
              <td>
                {i.lines[0]?.name}
                <small>
                  {pluralize(
                    i.lines.reduce((a, l) => a + l.qty, 0),
                    "participant",
                  )}
                  {i.lines.length > 1 ? ` · ${i.lines.length} activities` : ""}
                </small>
              </td>
              <td className="number">{money(i.total)}</td>
              <td>
                {i.payments
                  .map((p) => p.method)
                  .filter((v, j, a) => a.indexOf(v) === j)
                  .join(" + ") || "Unpaid"}
                <small>{money(paid(i))} collected</small>
              </td>
              {!compact && <td>{money(i.total - paid(i))}</td>}
              {role !== "Receptionist" && !compact && (
                <td>
                  {state.agents.find((a) => a.id === i.agentId)?.name ||
                    "Direct booking"}
                  <small>{money(i.commission)}</small>
                </td>
              )}
              <td>
                <InvoiceStatus invoice={i} />
              </td>
              <td className="invoice-actions-cell">
                <div className="invoice-quick-actions">
                  {i.status === "Active" &&
                    paid(i) < i.total &&
                    can("Sales Management", "edit") && (
                      <button
                        className="icon-button"
                        title="Record payment"
                        aria-label={`Record payment for ${i.id}`}
                        onClick={() =>
                          run(() => {
                            if (i.customerBookingId) {
                              recordPayment(i);
                              return;
                            }
                            openInvoice(i);
                            setTimeout(() => {
                              (
                                document.querySelector(
                                  '.invoice-operations input[name="amount"]',
                                ) as HTMLInputElement
                              )?.focus();
                            }, 100);
                          })
                        }
                      >
                        <CreditCard size={17} />
                      </button>
                    )}
                  {i.status === "Active" &&
                    paid(i) < i.total &&
                    can("Sales Management", "edit") && (
                      <button
                        className="icon-button"
                        title="Send reminder"
                        aria-label={`Send reminder for ${i.id}`}
                        onClick={() =>
                          run(() => {
                            requirePermission(
                              state,
                              role,
                              "Sales Management",
                              "edit",
                            );
                            setReminderInvoice(i);
                          })
                        }
                      >
                        <MessageCircle size={17} />
                      </button>
                    )}
                  {can("Sales Management", "print") && (
                    <button
                      className="icon-button"
                      title="Download PDF"
                      aria-label={`Download PDF for ${i.id}`}
                      onClick={() =>
                        run(() => {
                          openInvoice(i);
                          setFormat("A4");
                          setPdfRequest(i.id);
                        })
                      }
                    >
                      <Download size={17} />
                    </button>
                  )}
                </div>
                <button
                  className="icon-button"
                  title="View invoice"
                  aria-label="View invoice"
                  onClick={() => run(() => openInvoice(i))}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <div className="empty">No invoices match your search.</div>
      )}
    </div>
  );
  if (!logged)
    return (
      <div className="login">
        <div className="login-art">
          <Mountain size={54} />
          <h1>
            Every adventure.
            <br />
            One workspace.
          </h1>
          <p>
            From the first booking to the final summit, keep your business
            moving.
          </p>
          <span>ADVENTURE BUSINESS SUITE</span>
        </div>
        <div className="login-form">
          <span className="eyebrow">COMFYGEN TECHNOLOGIES</span>
          <h1>Welcome to your basecamp.</h1>
          <p>Select a demo role to explore your workspace.</p>
          <label>
            Demo role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {(["Super Admin", "Manager", "Receptionist"] as Role[]).map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </label>
          <Button disabled={switchingRole} onClick={() => switchRole(role)}>
            {switchingRole ? "Opening workspace…" : "Enter workspace"}{" "}
            <ArrowRight size={17} />
          </Button>
          <small>
            Interactive local prototype. Demo role switching is not production
            authentication. Data stays in this browser.
          </small>
        </div>
      </div>
    );
  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobile && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={mobile ? "sidebar mobile-open" : "sidebar"}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile || undefined}
        aria-label="Workspace navigation"
      >
        <div className="brand">
          <span className="brand-mark">
            <Mountain size={27} />
          </span>
          <div>
            adventure<span>BUSINESS SUITE</span>
          </div>
        </div>
        <div className="sidebar-controls">
          <span className="workspace-label">YOUR WORKSPACE</span>
          <button
            className="icon-button collapse-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => {
              setCollapsed(!collapsed);
              try {
                localStorage.setItem(
                  "adventure-sidebar-collapsed",
                  String(!collapsed),
                );
              } catch {
                notify("Sidebar preference could not be saved.");
              }
            }}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            className="icon-button drawer-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav>
          {modules
            .filter((m) => can(m))
            .map((m) => {
              const Icon = icons[modules.indexOf(m)];
              return (
                <button
                  key={m}
                  disabled={switchingRole}
                  onClick={() => navigate(m)}
                  className={page === m ? "active" : ""}
                  title={m}
                  aria-label={m}
                  aria-current={page === m ? "page" : undefined}
                >
                  <Icon size={19} />
                  <span className="nav-label">{m}</span>
                  {m === "Sales Management" && pendingInvoices.length > 0 && (
                    <span
                      className="nav-count"
                      aria-label={pluralize(
                        pendingInvoices.length,
                        "payment pending",
                      )}
                    >
                      {pendingInvoices.length}
                    </span>
                  )}
                  {m === "Billing POS" && <span className="nav-new">POS</span>}
                </button>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-links">
            <button
              onClick={() => {
                setMobile(false);
                setAppInfo("help");
              }}
              title="Help & support"
            >
              <HelpCircle size={18} />
              <span>Help & support</span>
            </button>
            <button
              onClick={() => {
                setMobile(false);
                setAppInfo("news");
              }}
              title="What's new"
            >
              <Sparkles size={18} />
              <span>What’s new</span>
            </button>
          </div>
          <div className="built">
            Developed by <b>Comfygen Technologies</b>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumbs">
            <button
              className="mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
            >
              <Menu size={20} />
            </button>
            <span className="workspace-crumb">Workspace</span>
            <span>/</span>
            <b>{page}</b>
          </div>
          <div className="header-right">
            {showDemoLabels && (
              <span
                className="live-dot"
                role="img"
                aria-label="Demo workspace active"
                title="Demo workspace active"
              />
            )}
            {showDemoLabels && (
              <span className="demo-label">Demo workspace</span>
            )}
            <button
              className="global-search-trigger"
              aria-label="Search workspace (Ctrl or Command K)"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={17} />
              <span>Search workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button notification-trigger"
              aria-label={`Notifications, ${unread} unread`}
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="notification-count">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
            <div className="header-divider" />
            <span className="avatar navy">AS</span>
            <select
              disabled={switchingRole}
              aria-label="Switch demo role"
              value={role}
              onChange={(e) => switchRole(e.target.value as Role)}
            >
              {(["Super Admin", "Manager", "Receptionist"] as Role[]).map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
            <button
              className="icon-button"
              title="Sign out"
              onClick={async () => {
                if (
                  page === "Billing POS" &&
                  billingDirty &&
                  !window.confirm(
                    "Sign out and leave this unsaved bill? Its draft will be kept in this browser.",
                  )
                )
                  return;
                try {
                  await fetch("/api/booking-staff/session", {
                    method: "DELETE",
                  });
                } catch {
                  notify(
                    "Could not lock the booking queue. Please retry signing out.",
                  );
                  return;
                }
                sessionStorage.removeItem("adventure-role");
                setLogged(false);
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <div className="content">
          <div
            className={`page-heading ${page === "Dashboard" ? "dashboard-heading" : ""}`}
          >
            <div>
              {page !== "Sales Management" && (
                <div className="eyebrow">
                  {page === "Billing POS"
                    ? "New bill"
                    : "YOUR ADVENTURE, AT A GLANCE"}
                </div>
              )}
              <h1>{page === "Dashboard" ? "Business overview" : page}</h1>
              <p>
                {
                  {
                    Dashboard:
                      "A clear view of your sales, collections and the adventures ahead.",
                    "Billing POS":
                      "Less time billing. More time creating unforgettable experiences.",
                    "Sales Management":
                      "Every booking, payment and customer in one place.",
                    "Agents & Commissions":
                      "Great partnerships. Clear commissions.",
                    "Invoice Designer":
                      "Make every invoice feel like your business.",
                    Customers: "The people behind every adventure.",
                    Reports:
                      "Turn your everyday numbers into better decisions.",
                    "Team & Permissions":
                      "The right access for every member of your team.",
                    Settings: "Your business, configured your way.",
                    "Customer Bookings":
                      "Share a booking link, see customer requests and collect payment at reception.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {page === "Dashboard" && (
                <Button
                  className="secondary"
                  onClick={() =>
                    run(() => {
                      requirePermission(state, role, "Reports", "export");
                      spreadsheet(
                        scoped.map((i) => ({
                          Invoice: i.id,
                          Revenue: i.base + i.charges,
                          Tax: i.tax,
                          Collections: paid(i),
                          Balance: i.total - paid(i),
                        })),
                        "Business-overview",
                      );
                    })
                  }
                >
                  <Download size={16} /> Export overview
                </Button>
              )}
              {can("Billing POS", "create") && page !== "Billing POS" && (
                <Button onClick={() => navigate("Billing POS")}>
                  <Plus size={18} /> Create invoice
                </Button>
              )}
            </div>
            {page === "Dashboard" && (
              <div className="dashboard-period">
                <PeriodTabs
                  range={range}
                  custom={!!(from || to)}
                  onSelect={(value) => {
                    setRange(value);
                    setFrom("");
                    setTo("");
                  }}
                />
                {dateFilters}
              </div>
            )}
          </div>
          {page === "Dashboard" && can("Dashboard") && (
            <Overview
              state={state}
              role={role}
              invoices={invoices}
              range={range}
              from={from}
              to={to}
              table={salesTable}
              onNavigate={(module, filter) => {
                navigate(module);
                if (filter === "outstanding" || filter === "period") {
                  const bounds = periodBounds(range, from, to);
                  const params = new URLSearchParams(location.search);
                  params.set(
                    "sales_metric",
                    filter === "outstanding" ? "outstanding" : "count",
                  );
                  params.set("sales_period", "custom");
                  params.set("sales_from", bounds?.start || "");
                  params.set("sales_to", bounds?.end || "");
                  window.history.replaceState(
                    null,
                    "",
                    location.pathname + "?" + params,
                  );
                }
                if (filter === "collections") {
                  setReport("Payment Collection Report");
                  const bounds = periodBounds(range, from, to);
                  setFrom(bounds?.start || "");
                  setTo(bounds?.end || "");
                }
              }}
              onAgent={(id) => {
                navigate("Agents & Commissions");
                setAgentView(id);
              }}
              onAddAgent={() => {
                navigate("Agents & Commissions");
                setAgentEdit({
                  id: "",
                  name: "",
                  phone: "",
                  rate: 10,
                  fixed: false,
                  active: true,
                });
              }}
            />
          )}
          {page === "Billing POS" && can("Billing POS") && (
            <BillingPos
              blocked={!!modal || commandOpen || mobile}
              onGlobalSearch={() => {
                setMobile(false);
                setCommandOpen((value) => !value);
              }}
              key={role}
              onDirtyChange={setBillingDirty}
              onWhatsApp={(invoice) => run(() => shareInvoice(invoice))}
              onPreview={(invoice) => {
                billingPreviewFocusRef.current = true;
                setFormat("A4");
                setModal(invoice);
              }}
              state={state}
              role={role}
              customerRequest={billingCustomer}
              onCustomerConsumed={() => setBillingCustomer(null)}
              onNotify={notify}
              onSave={(input, print) => {
                const next = createInvoice(state, role, input);
                setS(next);
                const invoice = next.invoices[next.invoices.length - 1];
                if (print) {
                  billingPreviewFocusRef.current = true;
                  setFormat("A4");
                  setModal(invoice);
                }
                return invoice;
              }}
            />
          )}
          {page === "Customer Bookings" && can("Customer Bookings") && (
            <BookingManager
              state={state}
              role={role}
              onReceipts={syncBookingReceipts}
              onBranding={syncBookingBranding}
              focusBookingId={bookingToCollect}
              onView={(invoice) => {
                requirePermission(state, role, "Sales Management", "print");
                setModal(invoice);
                setFormat("A4");
                setShareRequest(null);
              }}
            />
          )}
          {page === "Sales Management" && can("Sales Management") && (
            <SalesLedger
              state={state}
              role={role}
              onState={persistServiceCatalog}
              onView={openInvoice}
              onPdf={(i) => {
                setModal(i);
                setFormat("A4");
                setPdfRequest(i.id);
              }}
              onPayment={recordPayment}
              onReminder={setReminderInvoice}
              notify={notify}
            />
          )}
          {page === "Agents & Commissions" && can("Agents & Commissions") && (
            <>
              <div className="stats-grid">
                {stat(
                  "Active partners",
                  String(state.agents.filter((a) => a.active).length),
                  "Referral agent directory",
                  Users,
                )}
                {stat(
                  "Commission earned",
                  money(
                    state.agents.reduce((a, b) => a + earned(state, b.id), 0),
                  ),
                  "Active invoices · GST excluded",
                )}
                {stat(
                  "Paid & adjusted",
                  money(state.payouts.reduce((a, p) => a + p.amount, 0)),
                  "Settlement records",
                )}
                {stat(
                  "Outstanding commission",
                  money(
                    state.agents.reduce(
                      (a, b) => a + earned(state, b.id) - settled(state, b.id),
                      0,
                    ),
                  ),
                  "Agent liability",
                )}
              </div>
              <section className="card">
                <div className="section-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      placeholder="Search partners…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {can("Agents & Commissions", "create") && (
                    <Button
                      onClick={() =>
                        setAgentEdit({
                          id: "",
                          name: "",
                          phone: "",
                          rate: 10,
                          fixed: false,
                          active: true,
                        })
                      }
                    >
                      <Plus size={16} /> Add new agent
                    </Button>
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Referral partner</th>
                        <th>Commission</th>
                        <th>Bookings / Revenue</th>
                        <th>Earned</th>
                        <th>Paid / Adjusted</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {state.agents
                        .filter((a) =>
                          `${a.name} ${a.phone}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((a) => (
                          <tr key={a.id}>
                            <td>
                              <b>{a.name}</b>
                              <small>{a.phone}</small>
                            </td>
                            <td>{a.fixed ? money(a.rate) : `${a.rate}%`}</td>
                            <td>
                              {pluralize(
                                active.filter((i) => i.agentId === a.id).length,
                                "booking",
                              )}
                              <small>
                                {money(
                                  revenue(
                                    active.filter((i) => i.agentId === a.id),
                                  ),
                                )}
                              </small>
                            </td>
                            <td>{money(earned(state, a.id))}</td>
                            <td>{money(settled(state, a.id))}</td>
                            <td>
                              <b>
                                {money(
                                  earned(state, a.id) - settled(state, a.id),
                                )}
                              </b>
                            </td>
                            <td>
                              <span
                                className={`badge ${a.active ? "green" : "amber"}`}
                              >
                                {a.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="link"
                                onClick={() => setAgentView(a.id)}
                              >
                                Ledger
                              </button>{" "}
                              {can("Agents & Commissions", "edit") && (
                                <button
                                  className="link"
                                  onClick={() => setAgentEdit({ ...a })}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "Customers" && can("Customers") && (
            <section className="card">
              <div className="section-toolbar">
                <h3>{state.customers.length} adventure seekers</h3>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    placeholder="Search name or mobile…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Bookings</th>
                      {role !== "Receptionist" && <th>Total spending</th>}
                      <th>Last visit</th>
                      <th>Activities / Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.customers
                      .filter((c) =>
                        `${c.name} ${c.phone}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((c) => {
                        const bookings = active.filter(
                          (i) => i.customer.id === c.id,
                        );
                        return (
                          <tr key={c.id}>
                            <td>
                              <b>{c.name}</b>
                            </td>
                            <td>
                              {c.phone}
                              <small>{c.email}</small>
                            </td>
                            <td>
                              {bookings.length}
                              <details>
                                <summary>Booking history</summary>
                                {bookings.map((i) => (
                                  <p key={i.id}>
                                    {i.id} ·{" "}
                                    {new Date(i.date).toLocaleDateString(
                                      "en-IN",
                                    )}{" "}
                                    · {i.lines.map((l) => l.name).join(", ")}
                                  </p>
                                ))}
                              </details>
                            </td>
                            {role !== "Receptionist" && (
                              <td>
                                {money(
                                  bookings.reduce((a, i) => a + i.total, 0),
                                )}
                              </td>
                            )}
                            <td>
                              {bookings.length
                                ? bookings
                                    .map((i) => i.date)
                                    .sort()
                                    .reverse()[0]
                                    .slice(0, 10)
                                : "—"}
                            </td>
                            <td>
                              <small>
                                {Array.from(
                                  new Set(
                                    bookings.flatMap((i) =>
                                      i.lines.map((l) => l.name),
                                    ),
                                  ),
                                ).join(", ") || "No bookings yet"}
                              </small>
                              {c.notes}
                            </td>
                            <td>
                              <button
                                className="link"
                                onClick={() => {
                                  const key = `adventure-pos-draft-v1:${role}`;
                                  try {
                                    if (localStorage.getItem(key)) {
                                      if (
                                        !window.confirm(
                                          "An unsaved bill is stored for this role. Discard it and start a new booking for this customer?",
                                        )
                                      )
                                        return;
                                      localStorage.removeItem(key);
                                    }
                                  } catch {
                                    notify(
                                      "Unable to check the saved draft. Open Billing POS to review it first.",
                                    );
                                    return;
                                  }
                                  setBillingCustomer(c);
                                  navigate("Billing POS");
                                }}
                              >
                                New booking <ArrowRight size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === "Reports" && can("Reports") && (
            <>
              <section className="card">
                <div className="section-toolbar">
                  <label>
                    Report type
                    <select
                      value={report}
                      onChange={(e) => setReport(e.target.value)}
                    >
                      {[
                        "Sales report",
                        "Daily Sales Report",
                        "Monthly Sales Report",
                        "Yearly Sales Report",
                        "Activity-Wise Sales Report",
                        "GST Summary Report",
                        "Payment Collection Report",
                        "Agent Commission Report",
                        "Agent Ledger Report",
                        "Outstanding Payment Report",
                        "Excel Import Report",
                      ].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  {report !== "Sales report" && (
                    <>
                      {dateFilters}
                      <div className="heading-actions">
                        <Button
                          className="secondary"
                          onClick={() =>
                            run(() => {
                              requirePermission(
                                state,
                                role,
                                "Reports",
                                "export",
                              );
                              spreadsheet(reportData, report);
                            })
                          }
                        >
                          <Download size={16} /> Excel
                        </Button>
                        <Button
                          onClick={() =>
                            run(() => {
                              requirePermission(
                                state,
                                role,
                                "Reports",
                                "export",
                              );
                              pdf(
                                report,
                                reportData.map((row) =>
                                  Object.entries(row)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(" | "),
                                ),
                              );
                            })
                          }
                        >
                          Download PDF
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                {report !== "Sales report" && (
                  <>
                    <p className="info-note">
                      Revenue = discounted service value + non-taxable
                      additional charges, excluding GST. Cancelled and refunded
                      invoices are excluded. Tax reports require validation
                      before statutory filing. Commission settlements and import
                      history show all-time records.
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {Object.keys(reportData[0] || {}).map((k) => (
                              <th key={k}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((v, j) => (
                                <td key={j}>{String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
              {report === "Sales report" && (
                <SalesLedger
                  report
                  state={state}
                  role={role}
                  onState={persistServiceCatalog}
                  onView={openInvoice}
                  onPdf={(i) => {
                    setModal(i);
                    setFormat("A4");
                    setPdfRequest(i.id);
                  }}
                  onPayment={recordPayment}
                  onReminder={setReminderInvoice}
                  notify={notify}
                />
              )}
            </>
          )}
          {page === "Team & Permissions" && can("Team & Permissions") && (
            <section className="card">
              <h3>Role permissions</h3>
              <p className="muted">
                Exactly three demo roles. Super Admin always retains full
                access. Manager permissions are configurable; Receptionist
                restrictions are fixed.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Module / Role</th>
                      {actions.map((a) => (
                        <th key={a}>{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      ["Super Admin", "Manager", "Receptionist"] as Role[]
                    ).flatMap((r) =>
                      modules.map((m) => (
                        <tr key={r + m}>
                          <td>
                            <b>{m}</b>
                            <small>{r}</small>
                          </td>
                          {actions.map((a) => (
                            <td key={a}>
                              <input
                                aria-label={`${r} ${m} ${a}`}
                                type="checkbox"
                                checked={allowed(state, r, m, a)}
                                disabled={r !== "Manager"}
                                onChange={(e) =>
                                  run(() => {
                                    requirePermission(
                                      state,
                                      role,
                                      "Team & Permissions",
                                      "edit",
                                    );
                                    setS({
                                      ...state,
                                      permissions: {
                                        ...state.permissions,
                                        [`${r}:${m}:${a}`]: e.target.checked,
                                      },
                                    });
                                  })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === "Settings" && can("Settings") && (
            <>
              <section className="card">
                <h3>Business information</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    notify("Business details saved.");
                  }}
                >
                  <div className="form-grid">
                    {Object.entries(state.business).map(([key, val]) => (
                      <label key={key}>
                        {key}
                        <input
                          required
                          value={val}
                          onChange={(e) =>
                            run(() => {
                              requirePermission(
                                state,
                                role,
                                "Settings",
                                "edit",
                              );
                              setS({
                                ...state,
                                business: {
                                  ...state.business,
                                  [key]: e.target.value,
                                },
                              });
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <Button type="submit">Save business details</Button>
                </form>
              </section>
              <section className="card">
                <h3>Service catalog & tax configuration</h3>
                <p className="info-note">
                  Demo GST rates are illustrative administrator configurations,
                  not tax advice. Discounts are allocated proportionally before
                  per-line tax. Additional charges are non-taxable in this
                  prototype.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Service image</th>
                        <th>Category</th>
                        <th>Unit price</th>
                        <th>GST rate (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.services.map((v) => (
                        <tr key={v.id}>
                          <td>{v.name}</td>
                          <td>
                            <ServiceImageUpload
                              name={v.name}
                              category={v.category}
                              value={v}
                              disabled={!can("Settings", "edit")}
                              onChange={(images) => {
                                requirePermission(
                                  state,
                                  role,
                                  "Settings",
                                  "edit",
                                );
                                persistServiceCatalog({
                                  ...state,
                                  services: state.services.map((service) =>
                                    service.id === v.id
                                      ? { ...service, ...images }
                                      : service,
                                  ),
                                });
                              }}
                            />
                          </td>
                          <td>{v.category}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={v.price}
                              onChange={(e) =>
                                run(() => {
                                  requirePermission(
                                    state,
                                    role,
                                    "Settings",
                                    "edit",
                                  );
                                  const price = Number(e.target.value);
                                  if (price < 0)
                                    throw Error("Price cannot be negative");
                                  setS({
                                    ...state,
                                    services: state.services.map((a) =>
                                      a.id === v.id ? { ...a, price } : a,
                                    ),
                                  });
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={v.gst}
                              onChange={(e) =>
                                run(() => {
                                  requirePermission(
                                    state,
                                    role,
                                    "Settings",
                                    "edit",
                                  );
                                  const gst = Number(e.target.value);
                                  if (gst < 0 || gst > 100)
                                    throw Error("GST must be 0–100%");
                                  setS({
                                    ...state,
                                    services: state.services.map((a) =>
                                      a.id === v.id ? { ...a, gst } : a,
                                    ),
                                  });
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  Existing invoices retain the price, tax rate and commission
                  recorded when finalized.
                </p>
                <h4>Add service / tax configuration</h4>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => {
                      requirePermission(state, role, "Settings", "create");
                      const fd = new FormData(e.currentTarget);
                      const price = Number(fd.get("price")),
                        gst = Number(fd.get("gst"));
                      if (price < 0 || gst < 0 || gst > 100)
                        throw Error("Invalid price or GST");
                      persistServiceCatalog({
                        ...state,
                        services: [
                          ...state.services,
                          {
                            id: crypto.randomUUID(),
                            name: String(fd.get("name")),
                            category: String(fd.get("category")),
                            price,
                            gst,
                            ...newServiceImages,
                          },
                        ],
                      });
                      setNewServiceImages({});
                      setNewServiceName("");
                      notify("Service created");
                    });
                  }}
                >
                  <input
                    name="name"
                    placeholder="Activity name"
                    required
                    value={newServiceName}
                    onChange={(event) => setNewServiceName(event.target.value)}
                  />
                  <input name="category" placeholder="Category" required />
                  <input
                    name="price"
                    placeholder="Price"
                    type="number"
                    min="0"
                    required
                  />
                  <input
                    name="gst"
                    placeholder="GST %"
                    type="number"
                    min="0"
                    max="100"
                    required
                  />
                  <ServiceImageUpload
                    name={newServiceName || "New service"}
                    category=""
                    value={newServiceImages}
                    disabled={!can("Settings", "create")}
                    onBusyChange={setNewServiceImageBusy}
                    onChange={setNewServiceImages}
                  />
                  <Button disabled={newServiceImageBusy}>Add service</Button>
                </form>
              </section>
              <section className="card">
                <h3>Data & prototype storage</h3>
                <p>
                  Data is saved locally in this browser. This is a single-device
                  demo; production authentication and server-side authorization
                  require a backend.
                </p>
                <Button
                  className="secondary"
                  onClick={() =>
                    run(() => {
                      requirePermission(state, role, "Settings", "export");
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(
                        new Blob([JSON.stringify(state, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      link.download = "adventure-backup.json";
                      link.click();
                      URL.revokeObjectURL(link.href);
                    })
                  }
                >
                  Download full backup
                </Button>
              </section>
            </>
          )}
          {page === "Invoice Designer" && can("Invoice Designer") && (
            <>
              <div className="section-toolbar">
                <select
                  value={templateIndex}
                  onChange={(e) => {
                    setTemplateIndex(Number(e.target.value));
                    setDraft(null);
                    setHistory([]);
                    setRedo([]);
                  }}
                >
                  {state.templates.map((t, i) => (
                    <option key={i} value={i}>
                      {t.name}
                      {state.defaultTemplate === i ? " · Default" : ""}
                    </option>
                  ))}
                </select>
                <div className="heading-actions">
                  <Button
                    className="secondary"
                    disabled={!history.length}
                    onClick={() => {
                      setRedo([...redo, structuredClone(design)]);
                      setDraft(history[history.length - 1]);
                      setHistory(history.slice(0, -1));
                    }}
                  >
                    <Undo2 size={16} /> Undo
                  </Button>
                  <Button
                    className="secondary"
                    disabled={!redo.length}
                    onClick={() => {
                      setHistory([...history, structuredClone(design)]);
                      setDraft(redo[redo.length - 1]);
                      setRedo(redo.slice(0, -1));
                    }}
                  >
                    <Redo2 size={16} /> Redo
                  </Button>
                  <Button
                    onClick={() =>
                      run(() => {
                        requirePermission(
                          state,
                          role,
                          "Invoice Designer",
                          "edit",
                        );
                        setS({
                          ...state,
                          templates: state.templates.map((t, i) =>
                            i === templateIndex ? structuredClone(design) : t,
                          ),
                        });
                        notify("Template saved");
                      })
                    }
                  >
                    Save template
                  </Button>
                  <Button
                    className="secondary"
                    onClick={() =>
                      run(() => {
                        requirePermission(
                          state,
                          role,
                          "Invoice Designer",
                          "create",
                        );
                        setS({
                          ...state,
                          templates: [
                            ...state.templates,
                            {
                              ...structuredClone(design),
                              name: `${design.name} copy`,
                            },
                          ],
                        });
                        setTemplateIndex(state.templates.length);
                        setDraft(null);
                      })
                    }
                  >
                    Save as new
                  </Button>
                  <Button
                    className="secondary"
                    onClick={() => {
                      setS({ ...state, defaultTemplate: templateIndex });
                      notify("Default invoice template updated");
                    }}
                  >
                    Set default
                  </Button>
                </div>
              </div>
              <div className="designer">
                <section className="card components">
                  <h3>Components</h3>
                  <p>Drag canvas handles to reorder.</p>
                  {[
                    "Business Logo",
                    "Business Name",
                    "Business Address",
                    "Contact Information",
                    "GSTIN",
                    "Invoice Number",
                    "Invoice Date",
                    "Customer Details",
                    "Services Table",
                    "GST",
                    "Grand Total",
                    "Payment Summary",
                    "Terms & Conditions",
                    "Signature",
                    "Footer",
                    "Payment QR Code",
                  ].map((label) => (
                    <button
                      key={label}
                      onClick={() =>
                        updateDesign({
                          ...design,
                          sections: [
                            ...design.sections,
                            {
                              id: crypto.randomUUID(),
                              label,
                              visible: true,
                              align: "left",
                              font: 12,
                              color: "#123b5d",
                              spacing: 12,
                              width: 100,
                              border: false,
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={14} />
                      {label}
                    </button>
                  ))}
                  <label>
                    Company logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.size > 1000000)
                            return notify("Use an image under 1 MB");
                          const reader = new FileReader();
                          reader.onload = () =>
                            updateDesign({
                              ...design,
                              logo: String(reader.result),
                            });
                          reader.readAsDataURL(f);
                        }
                      }}
                    />
                  </label>
                  <label>
                    Signature image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.size > 1000000)
                            return notify("Use an image under 1 MB");
                          const r = new FileReader();
                          r.onload = () =>
                            updateDesign({
                              ...design,
                              signature: String(r.result),
                            });
                          r.readAsDataURL(f);
                        }
                      }}
                    />
                  </label>
                  <small>
                    Official Comfygen logo has not been supplied. Upload only
                    authorized business branding.
                  </small>
                </section>
                <section className="canvas-area">
                  <div className="tabs">
                    <button
                      className={format === "A4" ? "selected" : ""}
                      onClick={() => setFormat("A4")}
                    >
                      A4 invoice
                    </button>
                    <button
                      className={format === "Thermal" ? "selected" : ""}
                      onClick={() => setFormat("Thermal")}
                    >
                      Thermal receipt
                    </button>
                  </div>
                  <div
                    className={`invoice-canvas ${format === "Thermal" ? "thermal" : ""}`}
                    style={
                      format === "Thermal"
                        ? { width: `${Number(design.width) * 3}px` }
                        : undefined
                    }
                  >
                    <DndContext
                      collisionDetection={closestCenter}
                      onDragEnd={({ active, over }: DragEndEvent) => {
                        if (over && active.id !== over.id)
                          updateDesign({
                            ...design,
                            sections: arrayMove(
                              design.sections,
                              design.sections.findIndex(
                                (v) => v.id === active.id,
                              ),
                              design.sections.findIndex(
                                (v) => v.id === over.id,
                              ),
                            ),
                          });
                      }}
                    >
                      <SortableContext
                        items={design.sections.map((b) => b.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {design.sections.map((section) => (
                          <SortableBlock
                            key={section.id}
                            section={section}
                            onSelect={() => setSelected(section.id)}
                          >
                            <div
                              className={
                                selected === section.id ? "selected-block" : ""
                              }
                            >
                              {section.visible ? (
                                <InvoiceSection
                                  section={section}
                                  s={state}
                                  invoice={
                                    state.invoices[state.invoices.length - 1]
                                  }
                                  template={design}
                                />
                              ) : (
                                <span className="muted">
                                  {section.label} (hidden)
                                </span>
                              )}
                            </div>
                          </SortableBlock>
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </section>
                <section className="card properties">
                  <h3>Properties</h3>
                  <label>
                    Template name
                    <input
                      value={design.name}
                      onChange={(e) =>
                        updateDesign({ ...design, name: e.target.value })
                      }
                    />
                  </label>
                  {(() => {
                    const block = design.sections.find(
                      (b) => b.id === selected,
                    );
                    if (!block) return null;
                    const change = (v: Partial<Section>) =>
                      updateDesign({
                        ...design,
                        sections: design.sections.map((b) =>
                          b.id === selected ? { ...b, ...v } : b,
                        ),
                      });
                    const mandatory = [
                      "Business Name",
                      "Business Address",
                      "GSTIN",
                      "Invoice Number",
                      "Invoice Date",
                      "Customer Details",
                      "Services Table",
                      "GST",
                      "Grand Total",
                    ];
                    return (
                      <>
                        <label>
                          Label
                          <input
                            value={block.displayLabel || block.label}
                            onChange={(e) =>
                              change({ displayLabel: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Font size
                          <input
                            type="number"
                            min="8"
                            max="40"
                            value={block.font}
                            onChange={(e) =>
                              change({ font: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Alignment
                          <select
                            value={block.align}
                            onChange={(e) =>
                              change({
                                align: e.target.value as Section["align"],
                              })
                            }
                          >
                            <option>left</option>
                            <option>center</option>
                            <option>right</option>
                          </select>
                        </label>
                        <label>
                          Color
                          <input
                            type="color"
                            value={block.color}
                            onChange={(e) => change({ color: e.target.value })}
                          />
                        </label>
                        <label>
                          Spacing
                          <input
                            type="range"
                            min="0"
                            max="40"
                            value={block.spacing}
                            onChange={(e) =>
                              change({ spacing: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Width
                          <input
                            type="range"
                            min="40"
                            max="100"
                            value={block.width}
                            onChange={(e) =>
                              change({ width: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={block.border}
                            onChange={(e) =>
                              change({ border: e.target.checked })
                            }
                          />{" "}
                          Border
                        </label>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={block.visible}
                            disabled={mandatory.includes(block.label)}
                            onChange={(e) =>
                              change({ visible: e.target.checked })
                            }
                          />{" "}
                          Visible{" "}
                          {mandatory.includes(block.label) && "(required)"}
                        </label>
                      </>
                    );
                  })()}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!design.includeServiceImages}
                      onChange={(event) =>
                        updateDesign({
                          ...design,
                          includeServiceImages: event.target.checked,
                        })
                      }
                    />{" "}
                    Include service images on invoices
                  </label>
                  <label>
                    Receipt width
                    <select
                      value={design.width}
                      onChange={(e) =>
                        updateDesign({
                          ...design,
                          width: e.target.value as "58" | "80",
                        })
                      }
                    >
                      <option value="58">58 mm</option>
                      <option value="80">80 mm</option>
                    </select>
                  </label>
                  <label>
                    Terms & conditions
                    <textarea
                      value={design.terms}
                      onChange={(e) =>
                        updateDesign({ ...design, terms: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Footer
                    <textarea
                      value={design.footer}
                      onChange={(e) =>
                        updateDesign({ ...design, footer: e.target.value })
                      }
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={design.authorized}
                      onChange={(e) =>
                        updateDesign({
                          ...design,
                          authorized: e.target.checked,
                        })
                      }
                    />{" "}
                    Authorized signature
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={design.customerSignature}
                      onChange={(e) =>
                        updateDesign({
                          ...design,
                          customerSignature: e.target.checked,
                        })
                      }
                    />{" "}
                    Customer signature
                  </label>
                  <label>
                    Payment QR image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.size > 1000000)
                            return notify("Use an image under 1 MB");
                          const r = new FileReader();
                          r.onload = () =>
                            updateDesign({ ...design, qr: String(r.result) });
                          r.readAsDataURL(f);
                        }
                      }}
                    />
                  </label>
                  <h4>Table column order</h4>
                  {design.columns.map((c, i) => (
                    <div className="spread" key={c}>
                      {c}
                      <button
                        disabled={i === 0}
                        onClick={() =>
                          updateDesign({
                            ...design,
                            columns: arrayMove(design.columns, i, i - 1),
                          })
                        }
                      >
                        ↑ Move up
                      </button>
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} Adventure Business Suite</span>
            <span>
              Made for the business of adventure.{" "}
              {showDemoLabels && (
                <>
                  <span className="live-dot" /> Local data saved
                </>
              )}
            </span>
          </footer>
        </div>
      </main>
      {commandOpen && (
        <CommandPalette
          items={commandItems}
          onClose={() => setCommandOpen(false)}
        />
      )}
      {notificationsOpen && (
        <Dialog
          title="Notifications"
          onClose={() => setNotificationsOpen(false)}
        >
          <div className="spread">
            <p>{pluralize(unread, "unread notification")}</p>
            {unread > 0 && (
              <button
                className="link"
                onClick={() => markRead(notifications.map((item) => item.id))}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length ? (
              notifications.map((item) => (
                <button
                  className={
                    readNotifications.includes(item.id) ? "read" : "unread"
                  }
                  key={item.id}
                  onClick={() => {
                    markRead([item.id]);
                    setNotificationsOpen(false);
                    item.onSelect();
                  }}
                >
                  <span>
                    <b>{item.title}</b>
                    <small>{item.detail}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty">
                You’re all caught up. No pending work.
              </div>
            )}
          </div>
        </Dialog>
      )}
      {appInfo && (
        <Dialog
          title={appInfo === "help" ? "Help & support" : "What’s new"}
          onClose={() => setAppInfo(null)}
        >
          {appInfo === "help" ? (
            <>
              <p>Find your way around Adventure Business Suite.</p>
              <div className="help-topics">
                <h3>Start a booking</h3>
                <p>
                  Choose Billing POS, add a customer and activities, review tax
                  and payments, then save your invoice.
                </p>
                <h3>Collect an outstanding payment</h3>
                <p>
                  Open Outstanding payments on the dashboard. Select an invoice
                  and record its payment.
                </p>
                <h3>Find anything</h3>
                <p>
                  Press Ctrl+K or Cmd+K to search pages, invoices, customers and
                  agents. Press Escape to close dialogs.
                </p>
                <h3>Data & recovery</h3>
                <p>
                  Your records stay in this browser. Super Admin can download a
                  backup from Settings.
                </p>
              </div>
            </>
          ) : (
            <>
              <p>Dashboard improvements in this release</p>
              <ul className="release-notes">
                <li>Clear Unpaid, Partial and Paid invoice statuses.</li>
                <li>Indian date ranges, currency labels and readable text.</li>
                <li>
                  Clickable KPI cards, commission ledgers and invoice quick
                  actions.
                </li>
                <li>
                  Collection bars, cumulative revenue and payment-method
                  percentages.
                </li>
                <li>
                  Keyboard search, notifications, and a collapsible sidebar.
                </li>
              </ul>
            </>
          )}
        </Dialog>
      )}
      {reminderInvoice && can("Sales Management", "edit") && (
        <InvoiceReminder
          invoice={reminderInvoice}
          business={
            reminderInvoice.businessSnapshot?.name || state.business.name
          }
          onWhatsApp={
            can("Sales Management", "print")
              ? (message) => {
                  setReminderInvoice(null);
                  run(() => shareInvoice(reminderInvoice, message));
                }
              : undefined
          }
          onClose={() => setReminderInvoice(null)}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {agentEdit &&
        can("Agents & Commissions", agentEdit.id ? "edit" : "create") && (
          <div className="overlay">
            <section
              className="dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Referral partner details"
            >
              <div className="card-heading">
                <h2>
                  {agentEdit.id
                    ? "Edit referral partner"
                    : "Add referral partner"}
                </h2>
                <button onClick={() => setAgentEdit(null)} aria-label="Close">
                  <X />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => {
                    requirePermission(
                      state,
                      role,
                      "Agents & Commissions",
                      agentEdit.id ? "edit" : "create",
                    );
                    if (
                      agentEdit.rate < 0 ||
                      (!agentEdit.fixed && agentEdit.rate > 100)
                    )
                      throw Error("Enter a valid commission rate");
                    setS({
                      ...state,
                      agents: agentEdit.id
                        ? state.agents.map((a) =>
                            a.id === agentEdit.id ? agentEdit : a,
                          )
                        : [
                            ...state.agents,
                            { ...agentEdit, id: crypto.randomUUID() },
                          ],
                    });
                    setAgentEdit(null);
                    notify("Agent saved");
                  });
                }}
              >
                <label>
                  Agent name
                  <input
                    required
                    value={agentEdit.name}
                    onChange={(e) =>
                      setAgentEdit({ ...agentEdit, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Mobile number
                  <input
                    required
                    pattern="[0-9+ -]{10,15}"
                    value={agentEdit.phone}
                    onChange={(e) =>
                      setAgentEdit({ ...agentEdit, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Commission type
                  <select
                    value={agentEdit.fixed ? "fixed" : "percentage"}
                    onChange={(e) =>
                      setAgentEdit({
                        ...agentEdit,
                        fixed: e.target.value === "fixed",
                      })
                    }
                  >
                    <option value="percentage">
                      Percentage of discounted service amount
                    </option>
                    <option value="fixed">Fixed amount per invoice</option>
                  </select>
                </label>
                <label>
                  Commission value
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={agentEdit.rate}
                    onChange={(e) =>
                      setAgentEdit({
                        ...agentEdit,
                        rate: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={agentEdit.active}
                    onChange={(e) =>
                      setAgentEdit({ ...agentEdit, active: e.target.checked })
                    }
                  />{" "}
                  Active agent
                </label>
                <Button className="wide">Save partner</Button>
              </form>
            </section>
          </div>
        )}
      {selectedAgent && can("Agents & Commissions") && (
        <div className="overlay">
          <section
            className="dialog large"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace details"
          >
            <div className="card-heading">
              <div>
                <h2>{selectedAgent.name}</h2>
                <p>Commission ledger · {selectedAgent.phone}</p>
              </div>
              <button onClick={() => setAgentView("")} aria-label="Close">
                <X />
              </button>
            </div>
            <div className="micro-stats">
              <div>
                Earned<b>{money(earned(state, agentView))}</b>
              </div>
              <div>
                Paid / Adjusted<b>{money(settled(state, agentView))}</b>
              </div>
              <div>
                Outstanding
                <b>
                  {money(earned(state, agentView) - settled(state, agentView))}
                </b>
              </div>
            </div>
            <p className="info-note">
              Full cancellations and refunds reverse the full original
              commission. Original invoices and commission snapshots remain in
              history. Settlements remain recorded; a negative balance is an
              agent recovery.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date / Invoice</th>
                    <th>Customer</th>
                    <th>Base</th>
                    <th>Rate snapshot</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.invoices
                    .filter((i) => i.agentId === agentView)
                    .map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.date.slice(0, 10)}
                          <small>{i.id}</small>
                        </td>
                        <td>{i.customer.name}</td>
                        <td>{money(i.base)}</td>
                        <td>
                          {i.commissionType === "fixed"
                            ? money(i.commissionRate)
                            : `${i.commissionRate}%`}
                        </td>
                        <td>
                          {money(i.commission)}
                          {i.status !== "Active" && (
                            <small className="error">
                              Reversal: −{money(i.commission)}
                            </small>
                          )}
                        </td>
                        <td>
                          <InvoiceStatus invoice={i} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <h3>Settlement history</h3>
            {state.payouts
              .filter((p) => p.agentId === agentView)
              .map((p) => (
                <div className="settlement" key={p.id}>
                  <span>
                    {p.date.slice(0, 10)} · {p.kind} · {p.note}
                  </span>
                  <b>{money(p.amount)}</b>
                </div>
              ))}
            {can("Agents & Commissions", "edit") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => {
                    requirePermission(
                      state,
                      role,
                      "Agents & Commissions",
                      "edit",
                    );
                    const amount = Number(payout);
                    const outstanding = round(
                      earned(state, agentView) - settled(state, agentView),
                    );
                    if (
                      !Number.isFinite(amount) ||
                      amount === 0 ||
                      (!adjustment && (amount < 0 || amount > outstanding))
                    )
                      throw Error(
                        "Payout must be positive and cannot exceed outstanding commission",
                      );
                    setS({
                      ...state,
                      payouts: [
                        ...state.payouts,
                        {
                          id: crypto.randomUUID(),
                          agentId: agentView,
                          amount,
                          date: new Date().toISOString(),
                          note: payoutNote,
                          kind: adjustment ? "Adjustment" : "Payout",
                        },
                      ],
                    });
                    setPayout("");
                    setPayoutNote("");
                    notify("Settlement recorded");
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    Amount
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={payout}
                      onChange={(e) => setPayout(e.target.value)}
                    />
                  </label>
                  <label>
                    Reference / reason
                    <input
                      required
                      value={payoutNote}
                      onChange={(e) => setPayoutNote(e.target.value)}
                    />
                  </label>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={adjustment}
                    onChange={(e) => setAdjustment(e.target.checked)}
                  />{" "}
                  Ledger adjustment (negative values increase liability)
                </label>
                <Button>
                  Record {adjustment ? "adjustment" : "partial / full payout"}
                </Button>
              </form>
            )}
            {can("Agents & Commissions", "export") && (
              <Button
                className="secondary"
                onClick={() =>
                  run(() => {
                    requirePermission(
                      state,
                      role,
                      "Agents & Commissions",
                      "export",
                    );
                    spreadsheet(
                      [
                        ...state.invoices
                          .filter((i) => i.agentId === agentView)
                          .map((i) => ({
                            Date: i.date,
                            Reference: i.id,
                            Customer: i.customer.name,
                            Base: i.base,
                            Rate: i.commissionRate,
                            Earned: i.status === "Active" ? i.commission : 0,
                            Original: i.commission,
                            Settlement: 0,
                            Status: i.status,
                          })),
                        ...state.payouts
                          .filter((p) => p.agentId === agentView)
                          .map((p) => ({
                            Date: p.date,
                            Reference: p.note,
                            Customer: "",
                            Base: 0,
                            Rate: 0,
                            Earned: 0,
                            Original: 0,
                            Settlement: p.amount,
                            Status: p.kind,
                          })),
                      ],
                      "Agent-ledger",
                    );
                  })
                }
              >
                <Download size={16} /> Export ledger
              </Button>
            )}
          </section>
        </div>
      )}
      {modal && can("Sales Management", "print") && (
        <div className="overlay print-overlay">
          <section
            className="dialog invoice-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Invoice preview"
          >
            <div className="no-print invoice-preview-toolbar">
              <div className="card-heading">
                <h2>Invoice {modal.id}</h2>
                <div className="heading-actions">
                  {can("Billing POS", "create") && (
                    <Button
                      className="secondary"
                      onClick={() => {
                        setModal(null);
                        setShareRequest(null);
                        if (page !== "Billing POS") navigate("Billing POS");
                      }}
                    >
                      Continue billing
                    </Button>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Close"
                    onClick={() => {
                      setModal(null);
                      setShareRequest(null);
                    }}
                  >
                    <X />
                  </button>
                </div>
              </div>
              <div className="section-toolbar">
                <div className="tabs">
                  <button
                    disabled={shareRequest?.id === modal.id}
                    className={format === "A4" ? "selected" : ""}
                    onClick={() => setFormat("A4")}
                  >
                    A4
                  </button>
                  <button
                    disabled={shareRequest?.id === modal.id}
                    className={format === "Thermal" ? "selected" : ""}
                    onClick={() => setFormat("Thermal")}
                  >
                    Thermal {invoiceTemplate.width}mm
                  </button>
                </div>
                <div className="heading-actions">
                  <Button
                    className="secondary"
                    onClick={() => run(() => shareInvoice(modal))}
                  >
                    <MessageCircle size={16} /> WhatsApp PDF
                  </Button>
                  <Button
                    className="secondary"
                    onClick={() =>
                      run(() => {
                        requirePermission(
                          state,
                          role,
                          "Sales Management",
                          "print",
                        );
                        invoicePdf(
                          document.getElementById("print-invoice")!,
                          modal.id,
                          format === "Thermal",
                          Number(invoiceTemplate.width),
                        ).catch((e) =>
                          notify("PDF generation failed: " + e.message),
                        );
                      })
                    }
                  >
                    <Download size={16} /> PDF
                  </Button>
                  <Button
                    onClick={() =>
                      run(() => {
                        requirePermission(
                          state,
                          role,
                          "Sales Management",
                          "print",
                        );
                        window.print();
                      })
                    }
                  >
                    <Printer size={16} /> Print {format}
                  </Button>
                </div>
              </div>
            </div>
            {shareRequest?.id === modal.id && (
              <div className="no-print">
                <InvoiceWhatsApp
                  key={`${modal.id}-${modal.status}-${paid(modal)}`}
                  invoice={modal}
                  business={invoiceState.business.name}
                  message={shareRequest.message}
                  onClose={() => setShareRequest(null)}
                />
              </div>
            )}
            <div
              id="print-invoice"
              className={`invoice-canvas ${format === "Thermal" ? "thermal" : ""}`}
              style={
                format === "Thermal"
                  ? {
                      width: `${invoiceTemplate.width}mm`,
                    }
                  : undefined
              }
            >
              {invoiceTemplate.logo && (
                <img
                  src={invoiceTemplate.logo}
                  alt="Business logo"
                  className="invoice-logo"
                />
              )}
              {invoiceTemplate.sections
                .filter((b) => b.visible)
                .map((b) => (
                  <div
                    key={b.id}
                    style={{
                      fontSize: b.font,
                      color: b.color,
                      textAlign: b.align,
                      marginBottom: b.spacing,
                      width: `${b.width}%`,
                      border: b.border ? "1px solid #cbd5e1" : undefined,
                    }}
                  >
                    <InvoiceSection
                      section={b}
                      s={invoiceState}
                      invoice={modal}
                      template={invoiceTemplate}
                    />
                  </div>
                ))}
            </div>
            <div className="no-print invoice-operations">
              {modal.status === "Active" && paid(modal) >= modal.total && (
                <div className="invoice-paid-notice" role="status">
                  <Check size={20} />
                  <div>
                    <strong>Paid in full</strong>
                    <p>
                      {money(paid(modal))} received · Balance due {money(0)}. No
                      additional payment is needed.
                    </p>
                  </div>
                </div>
              )}
              {modal.customerBookingId &&
                paid(modal) < modal.total &&
                can("Customer Bookings", "create") && (
                  <div className="invoice-paid-notice">
                    <div>
                      <strong>Customer booking · Pay at reception</strong>
                      <p>
                        Collect the remaining {money(modal.total - paid(modal))}{" "}
                        in the shared booking queue.
                      </p>
                      <Button
                        className="secondary"
                        onClick={() => recordPayment(modal)}
                      >
                        Collect payment at reception
                      </Button>
                    </div>
                  </div>
                )}
              {!modal.customerBookingId &&
                modal.status === "Active" &&
                paid(modal) < modal.total &&
                can("Sales Management", "edit") && (
                  <div>
                    <p className="invoice-balance-notice">
                      Balance due:{" "}
                      <strong>{money(round(modal.total - paid(modal)))}</strong>
                    </p>
                    <form
                      className="inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const el = e.currentTarget;
                        run(() => {
                          requirePermission(
                            state,
                            role,
                            "Sales Management",
                            "edit",
                          );
                          const fd = new FormData(el);
                          const amount = Number(fd.get("amount"));
                          if (
                            !Number.isFinite(amount) ||
                            amount <= 0 ||
                            amount > round(modal.total - paid(modal))
                          )
                            throw Error("Payment must not exceed balance due");
                          const updated = {
                            ...modal,
                            payments: [
                              ...modal.payments,
                              {
                                amount,
                                method: String(fd.get("method")),
                                date: new Date().toISOString(),
                              },
                            ],
                          };
                          setS({
                            ...state,
                            invoices: state.invoices.map((i) =>
                              i.id === modal.id ? updated : i,
                            ),
                          });
                          setModal(updated);
                          notify("Payment recorded");
                        });
                      }}
                    >
                      <input
                        aria-label="Payment amount"
                        max={round(modal.total - paid(modal))}
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Collect balance"
                        required
                      />
                      <select name="method" aria-label="Payment method">
                        {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                      <Button>Record payment</Button>
                    </form>
                  </div>
                )}
              {!modal.customerBookingId &&
                modal.status === "Active" &&
                can("Sales Management", "cancel") && (
                  <div className="heading-actions">
                    {(["Cancelled", "Refunded"] as const).map((status) => (
                      <Button
                        className="danger secondary"
                        key={status}
                        onClick={() =>
                          run(() => {
                            requirePermission(
                              state,
                              role,
                              "Sales Management",
                              "cancel",
                            );
                            if (
                              !window.confirm(
                                `${status === "Refunded" ? "Refund" : "Cancel"} this full invoice? Commission will be reversed; original history is retained.`,
                              )
                            )
                              return;
                            const refundReason =
                              status === "Refunded"
                                ? window.prompt("Reason for full refund")
                                : undefined;
                            if (status === "Refunded" && !refundReason?.trim())
                              return;
                            const updated = {
                              ...modal,
                              status,
                              refundReason: refundReason?.trim(),
                            };
                            setS({
                              ...state,
                              invoices: state.invoices.map((i) =>
                                i.id === modal.id ? updated : i,
                              ),
                            });
                            setModal(updated);
                            notify(
                              "Invoice status updated; commission reversed.",
                            );
                          })
                        }
                      >
                        {status === "Refunded"
                          ? "Full refund"
                          : "Cancel invoice"}
                      </Button>
                    ))}
                  </div>
                )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function InvoiceSection(props: {
  section: Section;
  s: State;
  invoice: Invoice;
  template: Template;
}) {
  return (
    <>
      {props.section.displayLabel &&
        props.section.displayLabel !== props.section.label && (
          <small>{props.section.displayLabel}</small>
        )}
      <InvoiceContent {...props} />
    </>
  );
}
function InvoiceContent({
  section,
  s,
  invoice: i,
  template: t,
}: {
  section: Section;
  s: State;
  invoice: Invoice;
  template: Template;
}) {
  const label = section.label;
  switch (label) {
    case "Business Logo":
      return t.logo ? (
        <img src={t.logo} className="invoice-logo" alt="Business logo" />
      ) : (
        <span>Business logo</span>
      );
    case "Business Name":
      return <strong>{s.business.name}</strong>;
    case "Business Address":
      return <div>{s.business.address}</div>;
    case "Contact Information":
      return <div>{s.business.phone}</div>;
    case "GSTIN":
      return <div>GSTIN: {s.business.gstin}</div>;
    case "Invoice Number":
      return (
        <div>
          <b>TAX INVOICE · {i.id}</b> <InvoiceStatus invoice={i} />
        </div>
      );
    case "Invoice Date":
      return (
        <div>
          Date: {new Date(i.date).toLocaleDateString("en-IN")} · Place of
          supply: {i.interstate ? "Interstate" : s.business.state}
        </div>
      );
    case "Customer Details":
      return (
        <div>
          <small>BILL TO</small>
          <b>{i.customer.name}</b>
          <div>
            {i.customer.phone} {i.customer.email}
          </div>
          <div>{i.customer.address}</div>
          {i.customer.gstin && <div>Customer GSTIN: {i.customer.gstin}</div>}
        </div>
      );
    case "Services Table":
      return (
        <table className="invoice-table">
          <thead>
            <tr>
              {t.columns.map((c) => (
                <th key={c} data-column={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {i.lines.map((l, j) => (
              <tr key={j}>
                {t.columns.map((c) => (
                  <td key={c} data-column={c}>
                    {c === "Service" ? (
                      <>
                        <span className="invoice-service-name">
                          {t.includeServiceImages && (
                            <ServiceThumbnail
                              service={
                                s.services.find(
                                  (service) => service.id === l.serviceId,
                                ) || { name: l.name, category: "" }
                              }
                              size={36}
                              loading="eager"
                            />
                          )}
                          <span>{l.name}</span>
                        </span>
                        <small>
                          {l.date} {l.slot} · GST {l.gst}%
                        </small>
                      </>
                    ) : c === "Quantity" ? (
                      l.qty
                    ) : c === "Unit Price" ? (
                      money(l.price)
                    ) : c === "Discount" ? (
                      money(
                        i.subtotal
                          ? ((l.price * l.qty) / i.subtotal) * i.discount
                          : 0,
                      )
                    ) : c === "GST" ? (
                      `${l.gst}%`
                    ) : (
                      money(
                        l.price *
                          l.qty *
                          (1 - (i.subtotal ? i.discount / i.subtotal : 0)) *
                          (1 + l.gst / 100),
                      )
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "GST":
      return (
        <div className="summary-lines">
          <div>
            Service subtotal <b>{money(i.subtotal)}</b>
          </div>
          <div>
            Discount <b>{money(i.discount)}</b>
          </div>
          {i.interstate ? (
            <div>
              IGST <b>{money(i.tax)}</b>
            </div>
          ) : (
            <>
              <div>
                CGST <b>{money(round(i.tax / 2))}</b>
              </div>
              <div>
                SGST <b>{money(round(i.tax - round(i.tax / 2)))}</b>
              </div>
            </>
          )}
          <div>
            Non-taxable additional charges <b>{money(i.charges)}</b>
          </div>
        </div>
      );
    case "Grand Total":
      return (
        <div className="invoice-total">
          Grand total <strong>{money(i.total)}</strong>
        </div>
      );
    case "Payment Summary":
      return (
        <div>
          Paid: <b>{money(paid(i))}</b> · Balance:{" "}
          <b>{money(i.total - paid(i))}</b>
          <small>
            {i.payments
              .map((p) => `${p.method}: ${money(p.amount)}`)
              .join(" · ")}
          </small>
        </div>
      );
    case "Terms & Conditions":
      return (
        <>
          <b>Terms & conditions</b>
          <div>{t.terms}</div>
        </>
      );
    case "Signature":
      return (
        <div className="spread">
          {t.authorized && (
            <div>
              {t.signature && (
                <img
                  className="signature"
                  src={t.signature}
                  alt="Authorized signature"
                />
              )}
              <small>Authorized signature __________________</small>
            </div>
          )}
          {t.customerSignature && (
            <small>Customer signature __________________</small>
          )}
        </div>
      );
    case "Footer":
      return <div>{t.footer}</div>;
    case "Payment QR Code":
      return t.qr ? (
        <img src={t.qr} alt="Business payment QR code" width={120} />
      ) : (
        <div className="muted">
          Upload your payment QR in the designer properties.
        </div>
      );
    default:
      return <div>{label}</div>;
  }
}
function reportRows(
  s: State,
  invoices: Invoice[],
  report: string,
): Record<string, unknown>[] {
  if (report === "Excel Import Report")
    return s.imports.map((b) => ({
      Date: b.date,
      File: b.file,
      Accepted: b.accepted,
      Rejected: b.errors.length,
      Errors: b.errors.join("; "),
    }));
  if (report === "Agent Ledger Report")
    return [
      ...invoices
        .filter((i) => i.agentId)
        .map((i) => ({
          Date: i.date,
          Agent: s.agents.find((a) => a.id === i.agentId)?.name,
          Reference: i.id,
          Customer: i.customer.name,
          Base: i.base,
          Rate: i.commissionRate,
          Earned: i.status === "Active" ? i.commission : 0,
          Original: i.commission,
          Settlement: 0,
          Status: i.status,
        })),
      ...s.payouts.map((p) => ({
        Date: p.date,
        Agent: s.agents.find((a) => a.id === p.agentId)?.name,
        Reference: p.note,
        Customer: "",
        Base: 0,
        Rate: 0,
        Earned: 0,
        Settlement: p.amount,
        Status: p.kind,
      })),
    ];
  if (report === "Agent Commission Report")
    return s.agents.map((a) => ({
      Agent: a.name,
      Bookings: invoices.filter((i) => i.agentId === a.id).length,
      "Period earned": round(
        invoices
          .filter((i) => i.agentId === a.id)
          .reduce((n, i) => n + i.commission, 0),
      ),
      "All-time earned": earned(s, a.id),
      "All-time paid / adjusted": settled(s, a.id),
      "All-time outstanding": round(earned(s, a.id) - settled(s, a.id)),
    }));
  if (report === "Activity-Wise Sales Report")
    return s.services.map((v) => ({
      Activity: v.name,
      Participants: invoices.reduce(
        (a, i) =>
          a +
          i.lines
            .filter((l) => l.serviceId === v.id)
            .reduce((b, l) => b + l.qty, 0),
        0,
      ),
      "Net revenue": round(
        invoices.reduce(
          (a, i) =>
            a +
            i.lines
              .filter((l) => l.serviceId === v.id)
              .reduce(
                (b, l) =>
                  b +
                  l.qty *
                    l.price *
                    (1 - (i.subtotal ? i.discount / i.subtotal : 0)),
                0,
              ),
          0,
        ),
      ),
    }));
  if (report === "GST Summary Report")
    return invoices.map((i) => ({
      Invoice: i.id,
      Date: i.date.slice(0, 10),
      "Service taxable base": i.base,
      CGST: i.interstate ? 0 : round(i.tax / 2),
      SGST: i.interstate ? 0 : round(i.tax - round(i.tax / 2)),
      IGST: i.interstate ? i.tax : 0,
      "Total GST": i.tax,
    }));
  if (report === "Payment Collection Report")
    return invoices.flatMap((i) =>
      i.payments.map((p) => ({
        Invoice: i.id,
        Date: p.date,
        Method: p.method,
        Collection: p.amount,
      })),
    );
  if (report === "Outstanding Payment Report")
    return invoices
      .filter((i) => paid(i) < i.total)
      .map((i) => ({
        Invoice: i.id,
        Customer: i.customer.name,
        Mobile: i.customer.phone,
        Total: i.total,
        Paid: paid(i),
        Balance: round(i.total - paid(i)),
      }));
  const grouped: Record<
    string,
    { revenue: number; tax: number; total: number; paid: number; count: number }
  > = {};
  for (const i of invoices) {
    const key = i.date.slice(
      0,
      report.startsWith("Yearly") ? 4 : report.startsWith("Monthly") ? 7 : 10,
    );
    const g = grouped[key] || {
      revenue: 0,
      tax: 0,
      total: 0,
      paid: 0,
      count: 0,
    };
    g.revenue += i.base + i.charges;
    g.tax += i.tax;
    g.total += i.total;
    g.paid += paid(i);
    g.count++;
    grouped[key] = g;
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([Date, g]) => ({
      Date,
      Invoices: g.count,
      "Net revenue": round(g.revenue),
      GST: round(g.tax),
      "Invoice total": round(g.total),
      Collections: round(g.paid),
      Outstanding: round(g.total - g.paid),
      "Average invoice": round(g.total / g.count),
    }));
}
