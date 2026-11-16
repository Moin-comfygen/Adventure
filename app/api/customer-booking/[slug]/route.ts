import { NextRequest, NextResponse } from "next/server";
import {
  bookingFailure,
  ensureSameOrigin,
  limitedJson,
  throttle,
} from "@/lib/bookings/security";
import {
  getBookingSite,
  publicSite,
  submitCustomerBooking,
} from "@/lib/bookings/repository";
export const runtime = "nodejs";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const site = await getBookingSite((await params).slug);
    return NextResponse.json(
      site
        ? { site: publicSite(site) }
        : { error: "This booking link is not available." },
      { status: site ? 200 : 404, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    ensureSameOrigin(request);
    const slug = (await params).slug;
    await throttle(request, "customer-booking", 20, 3600000);
    const booking = await submitCustomerBooking(
      slug,
      await limitedJson(request),
    );
    return NextResponse.json(
      {
        booking: {
          reference: booking.reference,
          name: booking.name,
          phone: booking.phone,
          persons: booking.persons,
          date: booking.date,
          lines: booking.lines,
          total: booking.total,
          paymentOption: "reception",
          status: "Booked by customer",
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return bookingFailure(e);
  }
}
