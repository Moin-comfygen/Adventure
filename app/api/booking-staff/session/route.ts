import { NextRequest, NextResponse } from "next/server";
import {
  bookingFailure,
  ensureSameOrigin,
  logoutStaff,
  readStaff,
  staffConfigured,
  staffLogin,
} from "@/lib/bookings/security";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const role = readStaff(request);
  return NextResponse.json(
    { configured: staffConfigured(), authenticated: !!role, role },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  try {
    return await staffLogin(request);
  } catch (e) {
    return bookingFailure(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    ensureSameOrigin(request);
    return logoutStaff();
  } catch (e) {
    return bookingFailure(e);
  }
}
