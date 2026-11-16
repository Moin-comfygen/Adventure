import { CustomerBookingForm } from "@/components/bookings/customer-booking-form";
export const metadata = {
  title: "Book your adventure · Pay at reception",
  robots: { index: false, follow: false },
};
export default async function CustomerBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <CustomerBookingForm slug={(await params).slug} />;
}
