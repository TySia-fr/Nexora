import Link from "next/link";
import { getDashboard, LOW_STOCK_THRESHOLD } from "@/server/admin";
import { getAnalytics } from "@/server/analytics";
import { formatOrderNumber } from "@/server/orders";
import { AdminHeader, TableBox, td, th } from "@/components/admin/ui";
import { BarChart, Kpi, formatUnits } from "@/components/admin/metrics";
import { StatusBadge } from "@/components/ui/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { AdminGuard } from "@/components/admin/admin-guard";

const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Panel({
  title,
  id,
  action,
  children,
  className = "",
}: {
  title: string;
  id: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`min-w-0 rounded-card border border-line bg-surface p-5 ${className}`}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const more = (href: string, label: string) => (
  <Link href={href} className="text-sm text-fg-muted hover:text-accent">
    {label} →
  </Link>
);

async function AdminDashboardContent() {
  const [d, a] = await Promise.all([getDashboard(), getAnalytics(30)]);
  const attention = [
    { label: "Paid, awaiting shipment", value: d.awaitingFulfilment, href: "/admin/orders?status=PAID" },
    { label: "Variants out of stock", value: a.inventory.outOfStock, href: "/admin/inventory?level=out" },
    {
      label: "Variants at or below reorder point",
      value: a.inventory.low,
      href: "/admin/inventory?level=low",
    },
    { label: "Draft products", value: d.products.DRAFT ?? 0, href: "/admin/products?status=DRAFT" },
  ];

  return (
    <>
      <AdminHeader
        title="Dashboard"
        meta="Last 30 days · Europe/Paris"
        action={
          <div className="flex gap-2">
            <ButtonLink href="/admin/analytics" variant="secondary" size="sm">
              Full analytics
            </ButtonLink>
            <ButtonLink href="/admin/products/new" variant="inverse" size="sm">
              New product
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={formatMoney(a.current.revenueCents)} change={a.change.revenue} />
        <Kpi label="Orders" value={formatUnits(a.current.orders)} change={a.change.orders} />
        <Kpi
          label="Average order"
          value={formatMoney(a.current.averageOrderCents)}
          change={a.change.averageOrder}
        />
        <Kpi label="Units sold" value={formatUnits(a.current.units)} change={a.change.units} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Revenue by day" id="revenue" action={more("/admin/analytics", "Details")}>
          <BarChart
            label="Revenue by day, last 30 days"
            format={formatMoney}
            points={a.series.map((p) => ({
              key: p.day,
              label: shortDay.format(new Date(`${p.day}T00:00:00Z`)),
              value: p.revenueCents,
            }))}
          />
        </Panel>
        <Panel title="Needs attention" id="attention">
          <ul role="list" className="flex flex-col">
            {attention.map((x) => (
              <li key={x.label} className="border-t border-line first:border-t-0">
                <Link
                  href={x.href}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-accent"
                >
                  <span>{x.label}</span>
                  <span
                    className={`min-w-8 rounded-full px-2 py-0.5 text-center font-mono text-xs ${
                      x.value > 0 ? "bg-warn/15 text-warn" : "bg-well text-fg-subtle"
                    }`}
                  >
                    {x.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Recent orders" id="recent" action={more("/admin/orders", "All orders")}>
          <TableBox>
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {d.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className={td}>
                      <Link href={`/admin/orders/${o.id}`} className="font-mono hover:text-accent">
                        {formatOrderNumber(o.number)}
                      </Link>
                    </td>
                    <td className={td}>{o.shipFullName}</td>
                    <td className={td}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className={`${td} text-right font-mono`}>{formatMoney(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBox>
        </Panel>
        <Panel title="Top products" id="top" action={more("/admin/analytics", "All")}>
          {a.products.length === 0 ? (
            <p className="text-sm text-fg-muted">No sales in the last 30 days.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {a.products.slice(0, 5).map((p, i) => (
                <li key={p.productId ?? p.name} className="flex flex-col gap-1.5 text-sm">
                  <span className="flex justify-between gap-3">
                    <span className="truncate">
                      <span className="mr-2 font-mono text-fg-subtle">{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="shrink-0 font-mono">{formatMoney(p.salesCents)}</span>
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-well" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, p.shareOfSales * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel
        title={`Low stock (≤ ${LOW_STOCK_THRESHOLD})`}
        id="low"
        action={more("/admin/inventory?level=low", "Inventory")}
      >
        {d.lowStock.length === 0 ? (
          <p className="text-sm text-fg-muted">Everything is well stocked.</p>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {d.lowStock.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 border-t border-line py-2.5 text-sm">
                <Link href={`/admin/inventory/${v.id}`} className="truncate hover:text-accent">
                  {v.product.name} — {v.name}
                </Link>
                <span className={`font-mono ${v.stock === 0 ? "text-warn" : "text-fg-muted"}`}>
                  {v.stock}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <AdminDashboardContent />
    </AdminGuard>
  );
}
