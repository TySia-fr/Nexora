import type { Metadata } from "next";
import { ReviewNotice } from "@/components/ui/review-notice";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <>
      <h1 className="mb-8 text-display-l">Terms</h1>
      <ReviewNotice />
      <h2>This is a demonstration</h2>
      <p>
        NEXORA is a portfolio project. Products are fictional, orders are not fulfilled and payments run in
        Stripe test mode. Nothing on this site is an offer to sell.
      </p>
      <h2>Prices</h2>
      <p>
        Prices are in euros and include VAT. The price charged is the one calculated when you start payment.
      </p>
      <h2>Accounts</h2>
      <p>
        You are responsible for keeping your password private. We may remove accounts used to abuse the
        service.
      </p>
    </>
  );
}
