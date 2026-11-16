import { NextRequest, NextResponse } from "next/server";
import { bookingFailure, requireBookingStaff } from "@/lib/bookings/security";
import { bookingReceipts } from "@/lib/bookings/repository";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    requireBookingStaff(request);
    const value = Number(request.nextUrl.searchParams.get("since") || 0),
      since = Number.isFinite(value) && value >= 0 ? value : 0,
      after = request.nextUrl.searchParams.get("after") || "";
    return NextResponse.json(
      await bookingReceipts(since, after.slice(0, 100)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
