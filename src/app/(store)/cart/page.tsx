import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCart } from "@/server/cart";
import { getCartOwner } from "@/server/session";
import { CartLine } from "@/components/cart/cart-line";
import { CouponForm } from "@/components/cart/coupon-form";
import { SummaryRows } from "@/components/cart/order-summary";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

async function CartContent({ searchParams }: { searchParams: PageProps<"/cart">["searchParams"] }) {
  const owner = await getCartOwner();
  const cart = owner ? await getCart(owner) : null;
  const cancelled = (await searchParams).checkout === "cancelled";

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-card border border-line p-10">
        <h2 className="text-2xl font-medium">Your cart is empty.</h2>
        <p className="text-ash">Start with the core collection or browse by category.</p>
        <ButtonLink href="/products">Browse products</ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-14">
      <section aria-label="Items" className="min-w-0 flex-[999_1_560px]">
        {cancelled && (
          <p role="status" className="mb-6 rounded-card border border-line-strong p-4 text-sm text-mist">
            Payment was cancelled. Nothing was charged and your cart is unchanged.
          </p>
        )}
        {cart.hasIssues && (
          <p role="alert" className="mb-6 rounded-card border border-amber/60 p-4 text-sm text-amber">
            Some items changed since you added them. Review the highlighted lines before checking out.
          </p>
        )}
        <ul className="border-t border-line" role="list">
          {cart.lines.map((line) => (
            <CartLine key={line.id} line={line} />
          ))}
        </ul>
      </section>

      <aside
        aria-label="Order summary"
        className="flex flex-[1_1_320px] flex-col gap-6 self-start rounded-card border border-line bg-graphite p-7"
      >
        <h2 className="label-mono text-fog">
          Summary · {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
        </h2>
        <CouponForm applied={cart.couponCode} message={cart.couponMessage} />
        <SummaryRows totals={cart.totals} shippingLabel="Standard shipping" />
        {cart.totals.freeShippingRemainingCents > 0 && (
          <p className="text-[13px] text-ash">
            Add {formatMoney(cart.totals.freeShippingRemainingCents)} more for free standard shipping.
          </p>
        )}
        {cart.hasIssues ? (
          <span
            aria-disabled="true"
            className={buttonClasses("primary", "lg", "pointer-events-none w-full opacity-40")}
          >
            Resolve cart issues to continue
          </span>
        ) : (
          <ButtonLink href="/checkout" size="lg" className="w-full">
            Checkout
          </ButtonLink>
        )}
        <p className="text-xs text-fog">
          VAT included. Totals are recalculated on our server before payment.
        </p>
      </aside>
    </div>
  );
}

export default function CartPage({ searchParams }: PageProps<"/cart">) {
  return (
    <div className="container-site py-12">
      <div className="mb-10 flex items-end justify-between gap-4 border-b border-line pb-8">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Cart</h1>
        <Link href="/products" className="text-sm text-ash hover:text-signal">
          Continue shopping →
        </Link>
      </div>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-graphite" aria-busy="true" />}>
        <CartContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
