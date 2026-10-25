import type { Metadata } from "next";
import { ReviewNotice } from "@/components/ui/review-notice";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-8 text-5xl font-semibold tracking-[-0.03em]">Privacy</h1>
      <ReviewNotice />
      <p>This page lists exactly what this application stores, based on its database schema.</p>
      <h2>Accounts</h2>
      <ul>
        <li>Name and email address.</li>
        <li>A salted password hash (never the password itself).</li>
        <li>
          Sessions: an opaque token, expiry, IP address and browser user agent, so you can be signed out.
        </li>
        <li>Saved addresses you choose to add.</li>
      </ul>
      <h2>Orders</h2>
      <p>
        Email, shipping address, optional phone number, the items, prices and totals at the time of purchase,
        and the Stripe session identifier. Card details are entered on Stripe&apos;s page and never reach
        NEXORA.
      </p>
      <h2>Cookies and local storage</h2>
      <ul>
        <li>
          <span className="font-mono">nx.session_token</span> (or <span className="font-mono">__Secure-</span>{" "}
          prefixed in production): keeps you signed in. Strictly necessary.
        </li>
        <li>
          <span className="font-mono">nx_cart</span>: identifies a guest cart for 30 days. Strictly necessary.
        </li>
        <li>
          <span className="font-mono">nx:recently-viewed</span> in your browser&apos;s local storage: product
          ids you viewed, never sent to the server except to show that list to you.
        </li>
      </ul>
      <p>
        There are no analytics, advertising or third-party tracking scripts, so no consent banner is needed.
      </p>
      <h2>Newsletter</h2>
      <p>If you subscribe, your email address is stored until you unsubscribe.</p>
    </>
  );
}
