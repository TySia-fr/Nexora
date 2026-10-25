import type { Metadata } from "next";
import { Suspense } from "react";
import { getOrderByCheckoutSession, formatOrderNumber } from "@/server/orders";
import { ButtonLink } from "@/components/ui/button";
import { RefreshWhilePending } from "@/components/cart/refresh-while-pending";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order status", robots: { index: false } };

/**
 * Landing page after Stripe. It only READS the order: "paid" is set by the
 * verified webhook, never by reaching this URL (ADR-0004).
 */
async function Status({ searchParams }: { searchParams: PageProps<"/checkout/success">["searchParams"] }) {
  const sessionId = (await searchParams).session_id;
  const order =
    typeof sessionId === "string" && /^cs_[A-Za-z0-9_]{10,255}$/.test(sessionId)
      ? await getOrderByCheckoutSession(sessionId)
      : null;

  if (!order) {
    return (
      <>
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">We couldn&apos;t find that order.</h1>
        <p className="text-ash">If you completed a payment, the confirmation is on its way to your email.</p>
        <ButtonLink href="/" variant="secondary">
          Back to the store
        </ButtonLink>
      </>
    );
  }

  const number = formatOrderNumber(order.number);
  if (order.status === "PENDING_PAYMENT") {
    return (
      <>
        <RefreshWhilePending />
        <span className="label-mono text-amber">Confirming payment</span>
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">
          Waiting for Stripe to confirm order {number}.
        </h1>
        <p className="text-ash" role="status">
          This usually takes a few seconds. This page updates on its own; you can also close it — we&apos;ll
          keep your items reserved while the payment is confirmed.
        </p>
      </>
    );
  }
  if (order.status === "CANCELLED") {
    return (
      <>
        <span className="label-mono text-amber">Payment not completed</span>
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">Order {number} was not paid.</h1>
        <p className="text-ash">Nothing was charged. Your items have been released.</p>
        <ButtonLink href="/cart">Return to cart</ButtonLink>
      </>
    );
  }
  return (
    <>
      <span className="label-mono text-signal">Payment confirmed</span>
      <h1 className="text-4xl font-semibold tracking-[-0.03em]">Thank you. Order {number} is confirmed.</h1>
      <p className="text-ash">
        We received {formatMoney(order.totalCents)}. NEXORA is a demo store, so nothing will actually ship.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/account/orders">View your orders</ButtonLink>
        <ButtonLink href="/products" variant="secondary">
          Keep browsing
        </ButtonLink>
      </div>
    </>
  );
}

export default function SuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <div className="container-site flex max-w-3xl flex-col items-start gap-6 py-24">
      <Suspense fallback={<p aria-busy="true">Loading order…</p>}>
        <Status searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
