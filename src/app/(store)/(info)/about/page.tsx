import type { Metadata } from "next";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <>
      <h1 className="mb-8 text-display-l">About NEXORA</h1>
      <p>
        NEXORA is a fictional electronics brand. The store exists to demonstrate how a real e-commerce system
        is built: server-side pricing, stock that can&apos;t be oversold, payments confirmed only by the
        payment provider, accounts, and an admin back office.
      </p>
      <p>
        Every product, name, specification and image on this site was created for the project. None describes
        a real device. Product renders are generated from code, so they&apos;re original and never break.
      </p>
      <h2>What&apos;s real</h2>
      <ul>
        <li>The catalog, cart, checkout and order data live in PostgreSQL.</li>
        <li>Prices, discounts and shipping are calculated on the server for every request.</li>
        <li>Payments use Stripe in test mode; no card is ever charged.</li>
        <li>Nothing ships: orders are records, not parcels.</li>
      </ul>
      <h2>Built by</h2>
      <p>
        Siavash Izadi, full-stack developer. The source code, architecture decisions and tests are public on
        GitHub.
      </p>
    </>
  );
}
