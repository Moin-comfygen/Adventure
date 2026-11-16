import { NextRequest, NextResponse } from "next/server";
import {
  bookingFailure,
  ensureSameOrigin,
  limitedJson,
  requireBookingStaff,
} from "@/lib/bookings/security";
import { getBookingSite, publishBookingSite } from "@/lib/bookings/repository";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    requireBookingStaff(request);
    return NextResponse.json(
      { site: await getBookingSite() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    ensureSameOrigin(request);
    requireBookingStaff(request, true);
    return NextResponse.json(
      { site: await publishBookingSite(await limitedJson(request)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
