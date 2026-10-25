import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderAdmin, getOrderHistory } from "@/server/admin";
import { formatOrderNumber, ORDER_TRANSITIONS } from "@/server/orders";
import { AdminHeader } from "@/components/admin/ui";
import { OrderActions } from "@/components/admin/order-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/lib/money";
import { AdminGuard } from "@/components/admin/admin-guard";

async function AdminOrderContent({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const order = await getOrderAdmin(id);
  if (!order) notFound();
  const history = await getOrderHistory(id);

  return (
    <>
      <AdminHeader
        title={`Order ${formatOrderNumber(order.number)}`}
        meta={order.createdAt.toLocaleString("en-GB")}
        action={<StatusBadge status={order.status} />}
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-8">
          <ul className="divide-y divide-line rounded-card border border-line" role="list">
            {order.items.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                <span>
                  {i.productName}{" "}
                  <span className="text-fog">
                    · {i.variantName} · <span className="font-mono">{i.sku}</span> ·{" "}
                    {formatMoney(i.unitPriceCents)} × {i.quantity}
                  </span>
                </span>
                <span className="font-mono">{formatMoney(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-2 text-sm">
            <dt className="text-ash">Subtotal</dt>
            <dd className="font-mono">{formatMoney(order.subtotalCents)}</dd>
            <dt className="text-ash">Discount {order.couponCode && `(${order.couponCode})`}</dt>
            <dd className="font-mono">−{formatMoney(order.discountCents)}</dd>
            <dt className="text-ash">Shipping ({order.shippingMethod.toLowerCase()})</dt>
            <dd className="font-mono">{formatMoney(order.shippingCents)}</dd>
            <dt className="border-t border-line pt-2 font-semibold">Total</dt>
            <dd className="border-t border-line pt-2 font-mono">{formatMoney(order.totalCents)}</dd>
          </dl>
          <section aria-labelledby="history" className="flex flex-col gap-3">
            <h2 id="history" className="font-semibold">
              History
            </h2>
            <ol className="flex flex-col gap-2 text-sm text-ash">
              <li>{order.createdAt.toLocaleString("en-GB")} — order created</li>
              {order.paidAt && <li>{order.paidAt.toLocaleString("en-GB")} — payment confirmed by Stripe</li>}
              {history.map((h) => {
                const d = h.data as { from?: string; to?: string };
                return (
                  <li key={h.id}>
                    {h.createdAt.toLocaleString("en-GB")} — {d.from} → {d.to} by{" "}
                    {h.actor?.name ?? "deleted user"}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-card border border-line bg-graphite p-5">
            <h2 className="label-mono text-fog">Actions</h2>
            <OrderActions orderId={order.id} allowed={[...ORDER_TRANSITIONS[order.status]]} />
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-5 text-sm">
            <h2 className="label-mono text-fog">Customer</h2>
            <p>{order.email}</p>
            {order.user ? (
              <Link
                href={`/admin/customers?q=${encodeURIComponent(order.user.email)}`}
                className="text-ash hover:text-signal"
              >
                Account: {order.user.name}
              </Link>
            ) : (
              <p className="text-fog">Guest checkout</p>
            )}
            <address className="mt-2 leading-relaxed not-italic text-mist">
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
              {order.shipPhone && (
                <>
                  <br />
                  {order.shipPhone}
                </>
              )}
            </address>
          </section>
          <section className="flex flex-col gap-2 rounded-card border border-line p-5 text-sm">
            <h2 className="label-mono text-fog">Payments</h2>
            {order.payments.length === 0 && <p className="text-fog">None recorded.</p>}
            {order.payments.map((p) => (
              <p key={p.id} className="flex justify-between gap-2">
                <span className="font-mono text-xs">{p.providerSessionId.slice(0, 18)}…</span>
                <span>{p.status.toLowerCase()}</span>
              </p>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function AdminOrder(props: PageProps<"/admin/orders/[id]">) {
  return (
    <AdminGuard>
      <AdminOrderContent {...props} />
    </AdminGuard>
  );
}
