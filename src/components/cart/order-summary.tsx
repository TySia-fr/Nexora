import type { Totals } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";

export function SummaryRows({
  totals,
  shippingLabel = "Shipping",
}: {
  totals: Totals;
  shippingLabel?: string;
}) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-2.5 text-sm">
      <dt className="text-ash">Subtotal</dt>
      <dd className="font-mono">{formatMoney(totals.subtotalCents)}</dd>
      {totals.discountCents > 0 && (
        <>
          <dt className="text-ash">Discount {totals.appliedCoupon && `(${totals.appliedCoupon})`}</dt>
          <dd className="font-mono text-signal">−{formatMoney(totals.discountCents)}</dd>
        </>
      )}
      <dt className="text-ash">{shippingLabel}</dt>
      <dd className="font-mono">{totals.shippingCents === 0 ? "Free" : formatMoney(totals.shippingCents)}</dd>
      <div className="col-span-2 mt-2 grid grid-cols-[1fr_auto] border-t border-line-strong pt-3">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="font-mono text-lg">{formatMoney(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}
