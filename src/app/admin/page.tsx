import Link from "next/link";
import { getDashboard, LOW_STOCK_THRESHOLD } from "@/server/admin";
import { formatOrderNumber } from "@/server/orders";
import { AdminHeader, TableBox, td, th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { AdminGuard } from "@/components/admin/admin-guard";

async function AdminDashboardContent() {
  const d = await getDashboard();
  const kpis = [
    ["Revenue, paid · 30 days", formatMoney(d.revenueCents), `${d.paidOrders} paid orders`],
    ["Average order", formatMoney(d.averageOrderCents), "After discounts, VAT included"],
    ["Awaiting fulfilment", String(d.awaitingFulfilment), "Paid, not yet shipped"],
    [
      "Active products",
      String(d.products.ACTIVE ?? 0),
      `${d.products.DRAFT ?? 0} drafts · ${d.products.ARCHIVED ?? 0} archived`,
    ],
  ];
  return (
    <>
      <AdminHeader
        title="Dashboard"
        meta="Overview"
        action={
          <ButtonLink href="/admin/products/new" variant="inverse" size="sm">
            New product
          </ButtonLink>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, note]) => (
          <div key={label} className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-5">
            <span className="label-mono text-fg-subtle">{label}</span>
            <span className="text-3xl font-semibold tracking-[-0.02em]">{value}</span>
            <span className="text-xs text-fg-muted">{note}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <section aria-labelledby="recent" className="min-w-0 flex-[999_1_520px]">
          <div className="mb-3 flex justify-between">
            <h2 id="recent" className="font-semibold">
              Recent orders
            </h2>
            <Link href="/admin/orders" className="text-sm text-fg-muted hover:text-accent">
              All orders →
            </Link>
          </div>
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
        </section>
        <section
          aria-labelledby="low"
          className="flex-[1_1_280px] rounded-card border border-line bg-surface p-5"
        >
          <h2 id="low" className="mb-3 font-semibold">
            Low stock (≤ {LOW_STOCK_THRESHOLD})
          </h2>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-fg-muted">Everything is well stocked.</p>
          ) : (
            <ul className="flex flex-col" role="list">
              {d.lowStock.map((v) => (
                <li key={v.id} className="flex justify-between gap-3 border-t border-line py-2.5 text-sm">
                  <Link href={`/admin/products/${v.product.id}`} className="hover:text-accent">
                    {v.product.name} — {v.name}
                  </Link>
                  <span className={`font-mono ${v.stock === 0 ? "text-warn" : "text-fg-muted"}`}>
                    {v.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
