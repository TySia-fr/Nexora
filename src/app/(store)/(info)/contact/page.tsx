import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <>
      <h1 className="mb-8 text-display-l">Contact</h1>
      <p>
        NEXORA is a demo store, so there is no customer service team. For questions about the project itself,
        reach the developer through the portfolio site.
      </p>
      <h2>Store address</h2>
      <p>
        A real business would list its legal name, registered address and company number here. NEXORA has none
        and does not invent them.
      </p>
      <h2>Email</h2>
      <p>
        <span className="font-mono">{site.contactEmail}</span> — a placeholder on a reserved example domain;
        it does not receive mail.
      </p>
    </>
  );
}
