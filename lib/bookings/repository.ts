import { randomBytes } from "node:crypto";
import { z } from "zod";
import { bookingDatabase } from "./database";
import {
  BookingError,
  collectBookingPayment,
  inputHash,
  makeCustomerBooking,
} from "./domain";
import {
  bookingInput,
  collectionInput,
  type BookingSite,
  type CustomerBooking,
  type BookingStaffRole,
  type PublicBookingSite,
} from "./types";
const siteSchema = z.object({
  business: z.object({
    name: z.string().trim().min(2).max(120),
    address: z.string().max(500),
    phone: z.string().max(30),
    gstin: z.string().max(30),
    state: z.string().max(100),
  }),
  services: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().trim().min(1).max(150),
        category: z.string().max(80),
        price: z.number().finite().nonnegative().max(10000000),
        gst: z.number().finite().min(0).max(100),
        imageUrl: z.string().max(50000).nullable().optional(),
        thumbnailUrl: z.string().max(12000).nullable().optional(),
      }),
    )
    .min(1)
    .max(200)
    .refine(
      (a) => new Set(a.map((s) => s.id)).size === a.length,
      "Activity IDs must be unique.",
    ),
  template: z.unknown().optional(),
});
export async function getBookingSite(
  slug?: string,
): Promise<BookingSite | null> {
  const db = await bookingDatabase();
  const rows = await db.query(
    slug
      ? "SELECT data FROM adventure_booking_sites WHERE slug=$1"
      : "SELECT data FROM adventure_booking_sites WHERE id=$1",
    [slug || "default"],
  );
  return rows[0] ? JSON.parse(String(rows[0].data)) : null;
}
export function publicSite(site: BookingSite): PublicBookingSite {
  return {
    slug: site.slug,
    business: site.business,
    services: site.services,
    publishedAt: site.publishedAt,
  };
}
export async function publishBookingSite(raw: unknown) {
  const result = siteSchema.safeParse(raw);
  if (!result.success)
    throw new BookingError(
      result.error.issues[0]?.message || "Check the business and activities.",
    );
  const { template, ...data } = result.data;
  // Templates stay staff-only; public responses return business and catalog only.
  if (template && JSON.stringify(template).length > 1200000)
    throw new BookingError("The invoice template is too large.");
  const db = await bookingDatabase();
  return db.transaction(async (query) => {
    const initial: BookingSite = {
      ...data,
      id: "default",
      slug: randomBytes(24).toString("base64url"),
      publishedAt: new Date().toISOString(),
      template: template as BookingSite["template"],
    };
    await query(
      "INSERT INTO adventure_booking_sites (id,slug,data) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING",
      [initial.id, initial.slug, JSON.stringify(initial)],
    );
    const rows = await query(
      "SELECT data FROM adventure_booking_sites WHERE id=$1 FOR UPDATE",
      ["default"],
    );
    const prior: BookingSite = JSON.parse(String(rows[0].data));
    const site: BookingSite = { ...initial, slug: prior.slug };
    await query("UPDATE adventure_booking_sites SET data=$1 WHERE id=$2", [
      JSON.stringify(site),
      site.id,
    ]);
    return site;
  });
}
export async function submitCustomerBooking(slug: string, raw: unknown) {
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success)
    throw new BookingError(
      parsed.error.issues[0]?.message || "Check the booking details.",
    );
  const site = await getBookingSite(slug);
  if (!site) throw new BookingError("This booking link is not available.", 404);
  const hash = inputHash(parsed.data),
    db = await bookingDatabase();
  return db.transaction(async (query) => {
    const existing = await query(
      "SELECT data,input_hash,site_id FROM adventure_customer_bookings WHERE request_id=$1",
      [parsed.data.requestId],
    );
    if (existing[0]) {
      if (existing[0].input_hash !== hash || existing[0].site_id !== site.id)
        throw new BookingError(
          "This submission has changed. Start a new booking.",
          409,
        );
      return JSON.parse(String(existing[0].data)) as CustomerBooking;
    }
    const booking = makeCustomerBooking(parsed.data, site);
    await query(
      "INSERT INTO adventure_customer_bookings (id,reference,site_id,request_id,input_hash,created_at,updated_at,has_invoice,state,data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(request_id) DO NOTHING",
      [
        booking.id,
        booking.reference,
        booking.siteId,
        booking.requestId,
        hash,
        Date.parse(booking.createdAt),
        Date.parse(booking.createdAt),
        0,
        booking.status,
        JSON.stringify(booking),
      ],
    );
    const saved = await query(
      "SELECT data,input_hash FROM adventure_customer_bookings WHERE request_id=$1",
      [booking.requestId],
    );
    if (saved[0].input_hash !== hash)
      throw new BookingError(
        "This submission has changed. Start a new booking.",
        409,
      );
    return JSON.parse(String(saved[0].data)) as CustomerBooking;
  });
}
export async function listCustomerBookings(page: number, status: string) {
  const db = await bookingDatabase(),
    params: (string | number)[] = status ? [status] : [],
    where = status ? " WHERE state=$1" : "";
  const rows = await db.query(
    "SELECT data FROM adventure_customer_bookings" +
      where +
      ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, 25, (page - 1) * 25],
  );
  const count = await db.query(
    "SELECT COUNT(*) AS count FROM adventure_customer_bookings" + where,
    params,
  );
  return {
    bookings: rows.map(
      (row) => JSON.parse(String(row.data)) as CustomerBooking,
    ),
    total: Number(count[0].count),
    page,
    pageSize: 25,
  };
}
export async function recordCustomerPayment(
  id: string,
  raw: unknown,
  role: BookingStaffRole,
) {
  const parsed = collectionInput.safeParse(raw);
  if (!parsed.success)
    throw new BookingError("Check the payment amount and method.");
  const input = parsed.data,
    hash = inputHash(input),
    db = await bookingDatabase();
  return db.transaction(async (query) => {
    const rows = await query(
      "SELECT data,updated_at FROM adventure_customer_bookings WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!rows[0]) throw new BookingError("Booking not found.", 404);
    const booking: CustomerBooking = JSON.parse(String(rows[0].data));
    const prior = await query(
      "SELECT booking_id,input_hash FROM adventure_booking_payments WHERE id=$1",
      [input.requestId],
    );
    if (prior[0]) {
      if (prior[0].booking_id !== id || prior[0].input_hash !== hash)
        throw new BookingError(
          "A payment request cannot be reused for different details.",
          409,
        );
      return booking;
    }
    const updated = collectBookingPayment(booking, input, role);
    await query(
      "INSERT INTO adventure_booking_payments (id,booking_id,input_hash) VALUES ($1,$2,$3)",
      [input.requestId, id, hash],
    );
    await query(
      "UPDATE adventure_customer_bookings SET state=$1,data=$2,updated_at=$3,has_invoice=1 WHERE id=$4",
      [
        updated.status,
        JSON.stringify(updated),
        Math.max(Date.now(), Number(rows[0].updated_at) + 1),
        id,
      ],
    );
    return updated;
  });
}

export async function bookingReceipts(since: number, afterId: string) {
  const checkpoint = Date.now(),
    db = await bookingDatabase();
  const rows = await db.query(
    "SELECT id,data FROM adventure_customer_bookings WHERE has_invoice=1 AND updated_at >= $1 AND id > $2 ORDER BY id LIMIT 100",
    [Math.max(0, since - 60000), afterId],
  );
  return {
    receipts: rows
      .map((row) => (JSON.parse(String(row.data)) as CustomerBooking).invoice)
      .filter(Boolean),
    nextId: rows.length === 100 ? String(rows.at(-1)!.id) : null,
    checkpoint,
  };
}
