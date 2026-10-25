import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCart } from "@/server/cart";
import { db } from "@/server/db";
import { getCartOwner, getViewer } from "@/server/session";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { computeTotals } from "@/lib/pricing";
import { paymentsEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function CheckoutContent() {
  const owner = await getCartOwner();
  const cart = owner ? await getCart(owner) : null;
  if (!cart || cart.lines.length === 0 || cart.hasIssues) redirect("/cart");

  const viewer = await getViewer();
  const address = viewer
    ? await db.address.findFirst({
        where: { userId: viewer.id },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      })
    : null;

  const lines = cart.lines.map((l) => ({
    unitPriceCents: l.unitPriceCents,
    quantity: l.quantity,
    categoryId: l.categoryId,
  }));
  const coupon = cart.totals.appliedCoupon
    ? await db.coupon.findUnique({ where: { code: cart.totals.appliedCoupon } })
    : null;
  const now = new Date();
  const totals = {
    STANDARD: computeTotals({ lines, coupon, shippingMethod: "STANDARD", now }),
    EXPRESS: computeTotals({ lines, coupon, shippingMethod: "EXPRESS", now }),
  };

  return (
    <>
      <ul
        className="mb-10 flex flex-col divide-y divide-line rounded-card border border-line"
        role="list"
        aria-label="Items"
      >
        {cart.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-4 p-4 text-sm">
            <span>
              {l.productName}{" "}
              <span className="text-fg-subtle">
                · {l.variantName} · ×{l.quantity}
              </span>
            </span>
            <span className="font-mono">{formatMoney(l.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <CheckoutForm
        paymentsEnabled={paymentsEnabled}
        totals={totals}
        defaults={{
          email: viewer?.email ?? "",
          fullName: address?.fullName ?? viewer?.name ?? "",
          line1: address?.line1 ?? "",
          line2: address?.line2 ?? "",
          postalCode: address?.postalCode ?? "",
          city: address?.city ?? "",
          phone: address?.phone ?? "",
        }}
      />
    </>
  );
}

export default function CheckoutPage() {
  return (
    <div className="container-site max-w-[1200px] py-12">
      <h1 className="mb-10 border-b border-line pb-8 text-display-l">Checkout</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-well" aria-busy="true" />}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
