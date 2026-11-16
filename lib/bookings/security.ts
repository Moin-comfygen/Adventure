import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { BookingStaffRole } from "./types";
import { BookingError, inputHash } from "./domain";
import { bookingDatabase, bookingStorageConfigured } from "./database";
const cookieName = "adventure_booking_staff";
function secrets() {
  const admin = process.env.BOOKING_ADMIN_CODE,
    reception = process.env.BOOKING_RECEPTION_CODE;
  if (
    !admin ||
    admin.length < 16 ||
    !reception ||
    reception.length < 16 ||
    admin === reception
  )
    throw new BookingError(
      "Customer bookings need their staff access codes configured by the administrator.",
      503,
    );
  return { admin, reception };
}
export function staffConfigured() {
  try {
    secrets();
    return bookingStorageConfigured();
  } catch {
    return false;
  }
}
const equal = (a: string, b: string) => {
  const x = Buffer.from(inputHash(a)),
    y = Buffer.from(inputHash(b));
  return timingSafeEqual(x, y);
};
function signature(value: string) {
  const s = secrets();
  return createHmac("sha256", s.admin + "|" + s.reception)
    .update(value)
    .digest("base64url");
}
export function readStaff(request: NextRequest): BookingStaffRole | null {
  const value = request.cookies.get(cookieName)?.value;
  if (!value) return null;
  try {
    const [payload, sig] = value.split(".");
    if (!payload || !sig || !equal(signature(payload), sig)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      !["Admin", "Reception"].includes(data.role) ||
      !Number.isFinite(data.expires) ||
      data.expires < Date.now()
    )
      return null;
    return data.role;
  } catch {
    return null;
  }
}
export function requireBookingStaff(request: NextRequest, adminOnly = false) {
  const role = readStaff(request);
  if (!role)
    throw new BookingError("Sign in with your booking staff access code.", 401);
  if (adminOnly && role !== "Admin")
    throw new BookingError(
      "Only the booking administrator can publish or change the customer link.",
      403,
    );
  return role;
}
export function ensureSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const host = request.headers.get("host") || request.nextUrl.host;
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      request.nextUrl.protocol.replace(":", "");
    const expected = new URL(`${protocol}://${host}`).origin;
    if (new URL(origin).origin !== expected) throw new Error("origin");
  } catch {
    throw new BookingError(
      "This request must come from this booking site.",
      403,
    );
  }
}
export async function limitedJson(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new BookingError("Send the booking form as JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new BookingError("The form is empty.");
  const chunks: Uint8Array[] = [],
    limit = 4 * 1024 * 1024;
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new BookingError("The submitted form is too large.", 413);
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BookingError("The form could not be read. Please try again.");
  }
}
export async function throttle(
  request: NextRequest,
  prefix: string,
  limit: number,
  windowMs: number,
) {
  const db = await bookingDatabase();
  const address =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "local";
  const salt = process.env.BOOKING_ADMIN_CODE || "development";
  const key = inputHash(prefix + "|" + address + "|" + salt),
    now = Date.now(),
    expires = now + windowMs;
  const rows = await db.query(
    "INSERT INTO adventure_booking_throttle (key, attempts, expires_at) VALUES ($1, 1, $2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN adventure_booking_throttle.expires_at < $3 THEN 1 ELSE adventure_booking_throttle.attempts+1 END, expires_at=CASE WHEN adventure_booking_throttle.expires_at < $4 THEN $5 ELSE adventure_booking_throttle.expires_at END RETURNING attempts",
    [key, expires, now, now, expires],
  );
  if (Number(rows[0].attempts) > limit)
    throw new BookingError(
      "Too many attempts. Please wait and try again later.",
      429,
    );
}
export async function staffLogin(request: NextRequest) {
  ensureSameOrigin(request);
  if (!staffConfigured())
    throw new BookingError(
      "Customer booking storage and staff access are not configured yet.",
      503,
    );
  await throttle(request, "staff-login", 10, 15 * 60000);
  const body = await limitedJson(request);
  const code = typeof body.code === "string" ? body.code : "";
  const s = secrets();
  let role: BookingStaffRole;
  if (equal(code, s.admin)) role = "Admin";
  else if (equal(code, s.reception)) role = "Reception";
  else throw new BookingError("Incorrect staff access code.", 401);
  const payload = Buffer.from(
    JSON.stringify({
      role,
      expires: Date.now() + 12 * 3600000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  const response = NextResponse.json(
    { authenticated: true, role },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(cookieName, payload + "." + signature(payload), {
    httpOnly: true,
    secure: process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 3600,
  });
  return response;
}
export function logoutStaff() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
export function bookingFailure(error: unknown) {
  if (error instanceof BookingError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error(
    "Booking service failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    {
      error:
        "The booking service is temporarily unavailable. Please try again.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
