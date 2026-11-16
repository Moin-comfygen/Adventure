import { NextRequest, NextResponse } from "next/server";
import { bookingFailure, requireBookingStaff } from "@/lib/bookings/security";
import { listCustomerBookings } from "@/lib/bookings/repository";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    requireBookingStaff(request);
    const n = Number(request.nextUrl.searchParams.get("page") || 1),
      page = Number.isInteger(n) && n > 0 ? Math.min(n, 100000) : 1;
    const status = request.nextUrl.searchParams.get("status") || "";
    return NextResponse.json(
      await listCustomerBookings(
        page,
        ["Awaiting payment", "Partial", "Paid"].includes(status) ? status : "",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
