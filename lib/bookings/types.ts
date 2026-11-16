import { z } from "zod";
import type { Invoice, Service, State, Template } from "../model";
export type BookingSite = {
  id: string;
  slug: string;
  business: State["business"];
  services: Service[];
  template?: Template;
  publishedAt: string;
};
export type PublicBookingSite = Pick<
  BookingSite,
  "slug" | "business" | "services" | "publishedAt"
>;
export const bookingInput = z.object({
  requestId: z.string().uuid(),
  siteVersion: z.string().max(64).optional(),
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()+-]/g, "").replace(/^91(?=\d{10}$)/, ""))
    .refine((v) => /^\d{10}$/.test(v), "Enter a 10-digit mobile number."),
  persons: z.number().int().min(1).max(100),
  serviceIds: z
    .array(z.string().min(1).max(100))
    .min(1)
    .max(20)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Choose each activity once.",
    ),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).default(""),
  website: z.string().max(0).optional(),
});
export type BookingInput = z.infer<typeof bookingInput>;
export type CustomerBooking = {
  id: string;
  reference: string;
  siteId: string;
  requestId: string;
  createdAt: string;
  source: "customer";
  paymentOption: "reception";
  name: string;
  phone: string;
  persons: number;
  date: string;
  notes: string;
  lines: Invoice["lines"];
  subtotal: number;
  tax: number;
  total: number;
  collected: number;
  balance: number;
  status: "Awaiting payment" | "Partial" | "Paid";
  invoice?: Invoice;
  business: State["business"];
};
export type BookingStaffRole = "Admin" | "Reception";
export const collectionInput = z.object({
  requestId: z.string().uuid(),
  amount: z.number().finite().positive(),
  method: z.enum(["Cash", "UPI", "Card", "Bank Transfer"]),
});
export type CollectionInput = z.infer<typeof collectionInput>;
