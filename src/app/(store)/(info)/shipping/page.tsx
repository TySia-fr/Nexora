import type { Metadata } from "next";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { ReviewNotice } from "@/components/ui/review-notice";

export const metadata: Metadata = { title: "Shipping", alternates: { canonical: "/shipping" } };

// Rates below are read from the same constants the checkout uses.
export default function ShippingPage() {
  return (
    <>
      <h1 className="mb-8 text-display-l">Shipping</h1>
      <ReviewNotice />
      <h2>Where we ship</h2>
      <p>Mainland France and Corsica. Overseas departments and other countries are not available.</p>
      <h2>Rates</h2>
      <ul>
        <li>
          Standard (2–4 business days): {formatMoney(SHIPPING_RATES.STANDARD)}, free when your order is{" "}
          {formatMoney(FREE_SHIPPING_THRESHOLD)} or more after discounts.
        </li>
        <li>Express (next business day): {formatMoney(SHIPPING_RATES.EXPRESS)}, whatever the order value.</li>
      </ul>
      <h2>Reservations</h2>
      <p>
        When you start payment, your items are reserved for 30 minutes. If the payment isn&apos;t completed in
        that time, they go back on sale.
      </p>
    </>
  );
}
