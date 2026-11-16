import { NextRequest, NextResponse } from "next/server";
import {
  bookingFailure,
  ensureSameOrigin,
  limitedJson,
  requireBookingStaff,
} from "@/lib/bookings/security";
import { recordCustomerPayment } from "@/lib/bookings/repository";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    ensureSameOrigin(request);
    const role = requireBookingStaff(request);
    return NextResponse.json(
      {
        booking: await recordCustomerPayment(
          (await params).id,
          await limitedJson(request),
          role,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
