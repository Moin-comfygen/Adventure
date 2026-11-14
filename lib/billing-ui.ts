import { z } from "zod";
export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer’s name."),
  phone: z.string().regex(/^\d{10}$/, "Enter a 10-digit mobile number."),
  email: z.union([
    z.string().email("Enter a valid email address."),
    z.literal(""),
  ]),
  notes: z.string(),
  gstin: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value || /^\d{2}[A-Z]{5}\d{4}[A-Z][\dA-Z]Z[\dA-Z]$/.test(value),
      "Enter a valid 15-character GSTIN.",
    ),
  address: z.string().optional(),
});
export type CustomerFields = z.infer<typeof customerSchema>;
export const emptyCustomer: CustomerFields = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  gstin: "",
  address: "",
};
export function mobileDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
}
export function activityToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const paymentMethods = ["Cash", "UPI", "Card", "Bank Transfer"] as const;
export type PaymentMode = "full" | "partial" | "unpaid";
export type PaymentRow = { method: string; amount: number };
const cents = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export function resolvedPayments(
  mode: PaymentMode,
  rows: PaymentRow[],
  total: number,
): PaymentRow[] {
  if (mode === "unpaid") return [];
  if (!rows.length)
    return [{ method: "UPI", amount: mode === "full" ? total : 0 }];
  if (mode === "partial") return rows;
  return rows.map((row, index) =>
    index === rows.length - 1
      ? {
          ...row,
          amount: cents(
            Math.max(
              0,
              total - rows.slice(0, -1).reduce((sum, p) => sum + p.amount, 0),
            ),
          ),
        }
      : row,
  );
}
export function paymentError(
  mode: PaymentMode,
  rows: PaymentRow[],
  total: number,
) {
  const resolved = resolvedPayments(mode, rows, total);
  if (resolved.some((row) => !Number.isFinite(row.amount) || row.amount < 0))
    return "Payment amounts must be valid, non-negative numbers.";
  if (
    resolved.some(
      (row) =>
        !paymentMethods.includes(row.method as (typeof paymentMethods)[number]),
    )
  )
    return "Choose a valid payment method.";
  const collected = cents(resolved.reduce((sum, row) => sum + row.amount, 0));
  if (mode === "partial" && !(collected > 0 && collected < total))
    return "Partial payment must be more than ₹0 and less than the grand total.";
  if (mode === "full" && collected !== cents(total))
    return "Split payments must equal the grand total. Reduce the allocated amounts.";
  return "";
}
export function percentagePayments(rows: PaymentRow[], amount: number) {
  const sum = rows.reduce((n, row) => n + row.amount, 0);
  let allocated = 0;
  return rows.map((row, index) => {
    const value =
      index === rows.length - 1
        ? cents(amount - allocated)
        : sum > 0
          ? cents((amount * row.amount) / sum)
          : index === 0
            ? amount
            : 0;
    allocated += value;
    return { ...row, amount: value };
  });
}

export const billingDraftSchema = z.object({
  version: z.literal(1),
  customer: z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string(),
    notes: z.string(),
    gstin: z.string().optional(),
    address: z.string().optional(),
  }),
  persons: z.number().int().min(1),
  lines: z.array(
    z.object({
      serviceId: z.string(),
      name: z.string(),
      price: z.number(),
      qty: z.number().int().min(1),
      gst: z.number().min(0).max(100),
      date: z.string(),
      slot: z.string(),
    }),
  ),
  discountValue: z.number(),
  discountType: z.enum(["amount", "percent"]),
  charges: z.number(),
  agentId: z.string(),
  interstate: z.boolean(),
  paymentMode: z.enum(["full", "partial", "unpaid"]),
  paymentRows: z
    .array(z.object({ method: z.enum(paymentMethods), amount: z.number() }))
    .min(1)
    .max(4),
  updatedAt: z.string().optional(),
});
export type BillingDraft = z.infer<typeof billingDraftSchema>;
