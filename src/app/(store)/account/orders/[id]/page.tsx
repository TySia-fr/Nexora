import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireViewer } from "@/server/session";
import { formatOrderNumber, getOrderForUser } from "@/server/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/lib/money";

async function Order({ params }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer(`/account/orders/${id}`);
  // Scoped by userId: another customer's order id returns 404, not the order.
  const order = await getOrderForUser(viewer.id, id);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">Order {formatOrderNumber(order.number)}</h1>
        <StatusBadge status={order.status} />
      </header>
      <p className="-mt-6 text-sm text-ash">
        Placed {order.createdAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
        {order.paidAt && ` · paid ${order.paidAt.toLocaleDateString("en-GB")}`}
      </p>

      <ul className="divide-y divide-line rounded-card border border-line" role="list">
        {order.items.map((i) => (
          <li key={i.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
            <span>
              <Link href={`/products/${i.productSlug}`} className="hover:text-signal">
                {i.productName}
              </Link>{" "}
              <span className="text-fog">
                · {i.variantName} · <span className="font-mono">{i.sku}</span> · ×{i.quantity}
              </span>
            </span>
            <span className="font-mono">{formatMoney(i.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="ship-to" className="flex flex-col gap-2 text-sm">
          <h2 id="ship-to" className="label-mono text-fog">
            Ship to · {order.shippingMethod === "EXPRESS" ? "Express" : "Standard"}
          </h2>
          <address className="leading-relaxed not-italic text-mist">
            {order.shipFullName}
            <br />
            {order.shipLine1}
            {order.shipLine2 && (
              <>
                <br />
                {order.shipLine2}
              </>
            )}
            <br />
            {order.shipPostalCode} {order.shipCity}, {order.shipCountry}
          </address>
        </section>
        <dl className="grid grid-cols-[1fr_auto] gap-2 text-sm">
          <dt className="text-ash">Subtotal</dt>
          <dd className="font-mono">{formatMoney(order.subtotalCents)}</dd>
          {order.discountCents > 0 && (
            <>
              <dt className="text-ash">Discount {order.couponCode && `(${order.couponCode})`}</dt>
              <dd className="font-mono text-signal">−{formatMoney(order.discountCents)}</dd>
            </>
          )}
          <dt className="text-ash">Shipping</dt>
          <dd className="font-mono">
            {order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents)}
          </dd>
          <dt className="border-t border-line pt-2 font-semibold">Total</dt>
          <dd className="border-t border-line pt-2 font-mono">{formatMoney(order.totalCents)}</dd>
        </dl>
      </div>
      <Link href="/account/orders" className="text-sm text-ash hover:text-signal">
        ← All orders
      </Link>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-graphite" aria-busy="true" />}>
      <Order {...props} />
    </Suspense>
  );
}
