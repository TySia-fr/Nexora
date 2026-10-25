import type { Metadata } from "next";
import { ReviewNotice } from "@/components/ui/review-notice";

export const metadata: Metadata = { title: "Returns", alternates: { canonical: "/returns" } };

export default function ReturnsPage() {
  return (
    <>
      <h1 className="mb-8 text-display-l">Returns</h1>
      <ReviewNotice />
      <h2>30-day returns</h2>
      <p>
        You can return unused items in their original packaging within 30 days of delivery. In the EU,
        consumers also have a 14-day statutory right of withdrawal for online purchases; the 30-day window
        includes it.
      </p>
      <h2>Legal guarantee</h2>
      <p>
        Products sold to consumers in the EU are covered by the legal guarantee of conformity for two years
        from delivery.
      </p>
      <h2>How refunds are recorded</h2>
      <p>
        Refunds are issued to the original payment method through Stripe, then recorded on the order. Because
        NEXORA takes no real payments, no refund will ever be needed.
      </p>
    </>
  );
}
