import { createHash, randomUUID } from "node:crypto";
import {
  calculate,
  createInvoice,
  paid,
  round,
  type State,
  type Invoice,
} from "../model";
import { indiaDay } from "../sales-ledger";
import {
  bookingInput,
  collectionInput,
  type BookingSite,
  type CustomerBooking,
  type BookingStaffRole,
} from "./types";
export class BookingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function inputHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export function makeCustomerBooking(
  raw: unknown,
  site: BookingSite,
): CustomerBooking {
  const result = bookingInput.safeParse(raw);
  if (!result.success)
    throw new BookingError(
      result.error.issues[0]?.message || "Check the booking details.",
    );
  const input = result.data;
  if (input.siteVersion && input.siteVersion !== site.publishedAt)
    throw new BookingError(
      "The activities or prices were updated. Refresh activities and review your total before booking.",
      409,
    );
  const date = new Date(input.date + "T12:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.date ||
    input.date < indiaDay()
  )
    throw new BookingError("Choose today or a future activity date.");
  const last = new Date();
  last.setUTCFullYear(last.getUTCFullYear() + 1);
  if (date.getTime() > last.getTime())
    throw new BookingError("Choose a date within the next year.");
  const lines = input.serviceIds.map((id) => {
    const service = site.services.find((s) => s.id === id);
    if (!service)
      throw new BookingError(
        "An activity is no longer available. Please reload the page.",
      );
    return {
      serviceId: service.id,
      name: service.name,
      price: service.price,
      qty: input.persons,
      gst: service.gst,
      date: input.date,
      slot: "",
    };
  });
  const totals = calculate(lines, 0, 0);
  const id = randomUUID();
  return {
    id,
    reference: "BKG-" + id.replaceAll("-", "").slice(0, 10).toUpperCase(),
    siteId: site.id,
    requestId: input.requestId,
    createdAt: new Date().toISOString(),
    source: "customer",
    paymentOption: "reception",
    name: input.name,
    phone: input.phone,
    persons: input.persons,
    date: input.date,
    notes: input.notes,
    lines,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    collected: 0,
    balance: totals.total,
    status: "Awaiting payment",
    business: site.business,
  };
}
export function collectBookingPayment(
  booking: CustomerBooking,
  raw: unknown,
  role: BookingStaffRole,
): CustomerBooking {
  const parsed = collectionInput.safeParse(raw);
  if (!parsed.success)
    throw new BookingError(
      "Enter a positive amount and a valid payment method.",
    );
  const { amount, method } = parsed.data;
  if (
    booking.status === "Paid" ||
    amount > booking.balance ||
    round(amount) !== amount
  )
    throw new BookingError(
      "Payment must be greater than zero, in paise, and no more than the balance due.",
    );
  const payment = { amount, method, date: new Date().toISOString() };
  let invoice: Invoice;
  if (booking.invoice) {
    invoice = {
      ...booking.invoice,
      payments: [...booking.invoice.payments, payment],
    };
  } else {
    const state: State = {
      version: 1,
      services: [],
      agents: [],
      customers: [],
      invoices: [],
      payouts: [],
      imports: [],
      templates: [],
      defaultTemplate: 0,
      permissions: {},
      business: booking.business,
    };
    const next = createInvoice(
      state,
      role === "Admin" ? "Super Admin" : "Receptionist",
      {
        customer: {
          id: "",
          name: booking.name,
          phone: booking.phone,
          email: "",
          notes: booking.notes,
        },
        lines: booking.lines,
        discount: 0,
        charges: 0,
        interstate: false,
        agentId: "",
        payments: [payment],
        externalId: "customer-booking-" + booking.id,
      },
    );
    invoice = {
      ...next.invoices[0],
      id: "WEB-" + booking.reference.slice(4),
      customerBookingId: booking.id,
      businessSnapshot: booking.business,
    };
  }
  invoice = {
    ...invoice,
    customerBookingVersion: (booking.invoice?.customerBookingVersion || 0) + 1,
  };
  const collected = paid(invoice),
    balance = round(invoice.total - collected);
  return {
    ...booking,
    invoice,
    collected,
    balance,
    status: balance === 0 ? "Paid" : "Partial",
  };
}
