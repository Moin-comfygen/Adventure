import { demoCategories } from "./service-catalog";
export type Role = "Super Admin" | "Manager" | "Receptionist";
export type Module =
  | "Dashboard"
  | "Billing POS"
  | "Sales Management"
  | "Agents & Commissions"
  | "Invoice Designer"
  | "Customers"
  | "Reports"
  | "Team & Permissions"
  | "Settings"
  | "Customer Bookings";
export type Action = "view" | "create" | "edit" | "cancel" | "export" | "print";
export const modules: Module[] = [
  "Dashboard",
  "Billing POS",
  "Sales Management",
  "Agents & Commissions",
  "Invoice Designer",
  "Customers",
  "Reports",
  "Team & Permissions",
  "Settings",
  "Customer Bookings",
];
export const actions: Action[] = [
  "view",
  "create",
  "edit",
  "cancel",
  "export",
  "print",
];
export type Service = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  id: string;
  name: string;
  category: string;
  price: number;
  gst: number;
};
export type Agent = {
  id: string;
  name: string;
  phone: string;
  rate: number;
  fixed: boolean;
  active: boolean;
};
export type Customer = {
  gstin?: string;
  address?: string;
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};
export type Line = {
  serviceId: string;
  name: string;
  price: number;
  qty: number;
  gst: number;
  date: string;
  slot: string;
};
export type Payment = { method: string; amount: number; date: string };
export type Invoice = {
  customerBookingId?: string;
  customerBookingVersion?: number;
  businessSnapshot?: State["business"];
  refundReason?: string;
  id: string;
  externalId?: string;
  date: string;
  customer: Customer;
  lines: Line[];
  discount: number;
  charges: number;
  interstate: boolean;
  agentId: string;
  commissionRate: number;
  commissionType: "fixed" | "percentage";
  commission: number;
  payments: Payment[];
  status: "Active" | "Cancelled" | "Refunded";
  createdBy: Role;
  subtotal: number;
  tax: number;
  total: number;
  base: number;
};
export type Payout = {
  id: string;
  agentId: string;
  amount: number;
  date: string;
  note: string;
  kind: "Payout" | "Adjustment";
};
export type Section = {
  displayLabel?: string;
  id: string;
  label: string;
  visible: boolean;
  align: "left" | "center" | "right";
  font: number;
  color: string;
  spacing: number;
  width: number;
  border: boolean;
};
export type Template = {
  includeServiceImages?: boolean;
  qr?: string;
  name: string;
  sections: Section[];
  columns: string[];
  terms: string;
  footer: string;
  logo: string;
  signature: string;
  authorized: boolean;
  customerSignature: boolean;
  width: "58" | "80";
};
export type State = {
  bookingBranding?: { template?: Template; services: Service[] };
  version: 1;
  services: Service[];
  agents: Agent[];
  customers: Customer[];
  invoices: Invoice[];
  payouts: Payout[];
  audit?: { date: string; user: Role; action: string; detail: string }[];
  imports: {
    date: string;
    file: string;
    accepted: number;
    errors: string[];
    id?: string;
    user?: Role;
    created?: number;
    skipped?: number;
    failed?: number;
    undone?: boolean;
    undo?: import("./sales-import").ImportUndo;
  }[];
  templates: Template[];
  defaultTemplate: number;
  permissions: Record<string, boolean>;
  business: {
    name: string;
    address: string;
    phone: string;
    gstin: string;
    state: string;
  };
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function calculate(
  lines: Line[],
  discount: number,
  charges: number,
  agent?: Agent,
) {
  const subtotal = round(lines.reduce((a, l) => a + l.price * l.qty, 0));
  if (
    !lines.length ||
    lines.some(
      (l) =>
        !Number.isFinite(l.price) ||
        l.price < 0 ||
        !Number.isInteger(l.qty) ||
        l.qty < 1 ||
        !Number.isFinite(l.gst) ||
        l.gst < 0 ||
        l.gst > 100,
    )
  )
    throw Error("Add valid services, quantities and tax rates.");
  if (
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > subtotal ||
    !Number.isFinite(charges) ||
    charges < 0
  )
    throw Error("Discount must be between zero and service subtotal.");
  const base = round(subtotal - discount);
  const taxes = lines.map((l) =>
    round(
      (l.price * l.qty * (1 - (subtotal ? discount / subtotal : 0)) * l.gst) /
        100,
    ),
  );
  const tax = round(taxes.reduce((a, b) => a + b, 0));
  return {
    subtotal,
    base,
    tax,
    total: round(base + tax + charges),
    commission: agent
      ? round(agent.fixed ? agent.rate : (base * agent.rate) / 100)
      : 0,
    taxes,
  };
}
export const paid = (i: Invoice) =>
  round(i.payments.reduce((a, p) => a + p.amount, 0));
export const earned = (s: State, id: string) =>
  round(
    s.invoices
      .filter((i) => i.agentId === id && i.status === "Active")
      .reduce((a, i) => a + i.commission, 0),
  );
export const settled = (s: State, id: string) =>
  round(
    s.payouts.filter((p) => p.agentId === id).reduce((a, p) => a + p.amount, 0),
  );
export function allowed(s: State, role: Role, m: Module, a: Action = "view") {
  if (role === "Super Admin") return true;
  const key = `${role}:${m}:${a}`;
  if (key in s.permissions) return s.permissions[key];
  if (role === "Receptionist")
    return (
      (m === "Billing POS" && ["view", "create", "print"].includes(a)) ||
      (m === "Customer Bookings" && ["view", "create"].includes(a)) ||
      (m === "Customers" && a === "view") ||
      (m === "Sales Management" && ["view", "print"].includes(a))
    );
  return !["Settings", "Team & Permissions", "Invoice Designer"].includes(m);
}
export function requirePermission(
  s: State,
  role: Role,
  m: Module,
  a: Action = "view",
) {
  if (!allowed(s, role, m, a))
    throw Error("Your role does not permit this operation.");
}
export function visibleInvoices(s: State, role: Role) {
  requirePermission(s, role, "Sales Management");
  return role === "Receptionist"
    ? s.invoices.filter((i) => i.createdBy === "Receptionist")
    : s.invoices;
}
export function createInvoice(
  s: State,
  role: Role,
  input: {
    customer: Customer;
    lines: Line[];
    discount: number;
    charges: number;
    agentId: string;
    interstate: boolean;
    payments: Payment[];
    externalId?: string;
    date?: string;
  },
): State {
  requirePermission(s, role, "Billing POS", "create");
  if (
    !input.customer.name.trim() ||
    !/^\+?[\d\s-]{10,15}$/.test(input.customer.phone)
  )
    throw Error("Enter a customer name and valid mobile number.");
  if (
    input.externalId &&
    s.invoices.some((i) => i.externalId === input.externalId)
  )
    throw Error("Duplicate external sale ID.");
  if (input.interstate && !s.business.gstin)
    throw Error("Configure business GSTIN before interstate billing.");
  if (
    input.lines.some(
      (l) => !/^\d{4}-\d{2}-\d{2}$/.test(l.date) || isNaN(Date.parse(l.date)),
    )
  )
    throw Error("Select a valid activity date for each service.");
  if (
    input.payments.some(
      (p) => !["Cash", "UPI", "Card", "Bank Transfer"].includes(p.method),
    )
  )
    throw Error("Select a valid payment method.");
  const agent = s.agents.find((a) => a.id === input.agentId && a.active);
  if (input.agentId && !agent) throw Error("Select an active agent.");
  const totals = calculate(input.lines, input.discount, input.charges, agent);
  const amount = input.payments.reduce((a, p) => a + p.amount, 0);
  if (
    input.payments.some((p) => !Number.isFinite(p.amount) || p.amount < 0) ||
    amount > totals.total
  )
    throw Error("Payments cannot exceed the invoice total.");
  const customer = {
    ...input.customer,
    id:
      s.customers.find((c) => c.phone === input.customer.phone)?.id ||
      crypto.randomUUID(),
  };
  const invoice: Invoice = {
    ...input,
    ...totals,
    id: `ADV-${String(s.invoices.length + 1).padStart(5, "0")}`,
    date: input.date || new Date().toISOString(),
    commissionRate: agent?.rate || 0,
    commissionType: agent?.fixed ? "fixed" : "percentage",
    status: "Active",
    createdBy: role,
    customer,
  };
  return {
    ...s,
    customers: [...s.customers.filter((c) => c.id !== customer.id), customer],
    invoices: [...s.invoices, invoice],
  };
}
export function seed(): State {
  const names = [
    "River Rafting · 16 km",
    "Bungee Jumping",
    "Kayaking",
    "Kedarkantha Trek",
    "Zipline Adventure",
    "River Rafting · 24 km",
    "Camping by the Ganges",
    "Rock Climbing",
    "Flying Fox",
    "Valley Nature Walk",
  ];
  const services = names.map((name, i) => ({
    id: `s${i}`,
    name,
    category: demoCategories[i],
    imageUrl: `/images/services/s${i}.svg`,
    thumbnailUrl: `/images/services/s${i}-thumb.svg`,
    price: [1500, 3550, 1200, 8500, 1800, 2500, 2200, 900, 1600, 750][i],
    gst: [5, 18, 5, 12, 18][i % 5],
  }));
  const agents = [
    "Rajeev Sharma",
    "Priya Rawat",
    "Vikram Negi",
    "Anjali Bisht",
    "Rohit Joshi",
    "Meera Shah",
    "Aman Singh",
    "Kavita Rana",
    "Deepak Pant",
    "Neha Verma",
    "Sanjay Nautiyal",
    "Pooja Mehta",
  ].map((name, i) => ({
    id: `a${i}`,
    name,
    phone: `98765000${String(i).padStart(2, "0")}`,
    rate: i === 0 ? 10 : [8, 10, 12][i % 3],
    fixed: false,
    active: i !== 11,
  }));
  const customers = Array.from({ length: 100 }, (_, i) => ({
    id: `c${i}`,
    name: `${["Amit", "Sneha", "Arjun", "Riya", "Rahul", "Ishita", "Karan", "Ananya", "Dev", "Nisha"][i % 10]} ${["Sharma", "Kapoor", "Singh", "Rawat", "Mehta", "Gupta", "Verma", "Bisht", "Joshi", "Rana"][Math.floor(i / 10)]}`,
    phone: `98${String(10000000 + i)}`,
    email: `traveler${i + 1}@example.com`,
    notes: "",
  }));
  const sections = [
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
  ].map((label, i) => ({
    id: `b${i}`,
    label,
    visible: true,
    align: "left" as const,
    font: i === 0 ? 24 : 12,
    color: "#123B5D",
    spacing: 12,
    width: 100,
    border: false,
  }));
  let s: State = {
    version: 1,
    services,
    agents,
    customers,
    invoices: [],
    payouts: [],
    imports: [],
    templates: [
      {
        name: "Adventure Classic",
        includeServiceImages: false,
        sections,
        columns: [
          "Service",
          "Quantity",
          "Unit Price",
          "Discount",
          "GST",
          "Total",
        ],
        terms:
          "Please arrive 30 minutes before your activity. Bookings are subject to weather and safety conditions.",
        footer: "Thank you for choosing adventure. Travel safe, explore more.",
        logo: "",
        signature: "",
        authorized: true,
        customerSignature: false,
        width: "80",
      },
    ],
    defaultTemplate: 0,
    permissions: {},
    business: {
      name: "Himalayan Adventure Co.",
      address: "Tapovan, Rishikesh, Uttarakhand · 249192",
      phone: "+91 98765 43210",
      gstin: "05ABCDE1234F1Z5",
      state: "Uttarakhand",
    },
  };
  for (let i = 0; i < 75; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i < 10 ? i % 2 : i % 90));
    const svc = services[i % 10],
      agent = i % 4 === 0 ? undefined : agents[i % 11];
    const lines = [
      {
        serviceId: svc.id,
        name: svc.name,
        price: svc.price,
        qty: (i % 5) + 1,
        gst: svc.gst,
        date: date.toISOString().slice(0, 10),
        slot: "09:00",
      },
    ];
    const discount = i % 3 === 0 ? 200 : 0;
    const t = calculate(lines, discount, 0, agent);
    s = createInvoice(s, "Super Admin", {
      customer: customers[i],
      lines,
      discount,
      charges: 0,
      agentId: agent?.id || "",
      interstate: i % 7 === 0,
      payments: [
        {
          method: ["UPI", "Cash", "Card", "Bank Transfer"][i % 4],
          amount: round(t.total * (i % 5 === 0 ? 0.5 : 1)),
          date: date.toISOString(),
        },
      ],
      date: date.toISOString(),
    });
  }
  s.payouts = agents.slice(0, 8).map((a) => ({
    id: crypto.randomUUID(),
    agentId: a.id,
    amount: round(earned(s, a.id) * 0.6),
    date: new Date().toISOString(),
    note: "Opening commission settlement",
    kind: "Payout",
  }));
  return s;
}
// Future extension points only: waivers and invoice documents can reference immutable invoice IDs.
export type FutureDocument = {
  id: string;
  invoiceId: string;
  kind: "waiver" | "signed-invoice";
  storageKey: string;
};
