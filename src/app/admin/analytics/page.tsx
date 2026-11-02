import Link from "next/link";
import { getAnalytics } from "@/server/analytics";
import { AdminHeader, TableBox, td, th } from "@/components/admin/ui";
import { BarChart, Kpi, formatCover, formatPercent, formatUnits } from "@/components/admin/metrics";
import { AdminGuard } from "@/components/admin/admin-guard";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { ANALYTICS_RANGES, analyticsRangeSchema } from "@/lib/validation/inventory";

export const metadata = { title: "Analytics" };

const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

async function AnalyticsContent({ searchParams }: PageProps<"/admin/analytics">) {
  const sp = await searchParams;
  const days = analyticsRangeSchema.parse(Array.isArray(sp.days) ? sp.days[0] : sp.days);
  const a = await getAnalytics(days);
  const { current: c, change, inventory: inv } = a;
  const marginRate = c.netSalesWithCostCents > 0 ? c.grossMarginCents / c.netSalesWithCostCents : null;

  return (
    <>
      <AdminHeader title="Analytics" meta={`Last ${days} days · compared with the ${days} days before`} />
      <nav aria-label="Period" className="mb-6 flex flex-wrap gap-1.5">
        {ANALYTICS_RANGES.map((d) => (
          <Link
            key={d}
            href={`/admin/analytics?days=${d}`}
            aria-current={d === days ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm",
              d === days ? "border-fg bg-fg text-canvas" : "border-line-strong text-fg-muted hover:border-fg",
            )}
          >
            {d === 365 ? "12 months" : `${d} days`}
          </Link>
        ))}
      </nav>

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Revenue"
          value={formatMoney(c.revenueCents)}
          change={change.revenue}
          note="Paid, VAT incl."
        />
        <Kpi label="Orders" value={formatUnits(c.orders)} change={change.orders} />
        <Kpi label="Average order" value={formatMoney(c.averageOrderCents)} change={change.averageOrder} />
        <Kpi label="Units sold" value={formatUnits(c.units)} change={change.units} />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Net sales"
          value={formatMoney(c.netSalesCents)}
          note="After discounts, ex. VAT and shipping"
        />
        <Kpi
          label="Gross margin"
          value={formatMoney(c.grossMarginCents)}
          change={change.grossMargin}
          note={`${formatPercent(marginRate)} of net sales${c.unitsWithoutCost ? ` · ${c.unitsWithoutCost} units without cost excluded` : ""}`}
        />
        <Kpi label="Discounts given" value={formatMoney(c.discountCents)} note="VAT incl." />
        <Kpi
          label="Refunded"
          value={formatMoney(c.refundedCents)}
          note={`${c.refundedOrders} ${c.refundedOrders === 1 ? "order" : "orders"}, not in revenue`}
          invert
        />
      </div>

      <section aria-labelledby="trend" className="mb-10 rounded-card border border-line p-6">
        <h2 id="trend" className="mb-4 font-semibold">
          Revenue by {a.range.bucket === "week" ? "week" : "day"}
        </h2>
        <BarChart
          label={`Revenue by ${a.range.bucket}, Europe/Paris`}
          format={formatMoney}
          points={a.series.map((p) => ({
            key: p.day,
            label: shortDay.format(new Date(`${p.day}T00:00:00Z`)),
            value: p.revenueCents,
          }))}
        />
      </section>

      <section aria-labelledby="products" className="mb-10">
        <h2 id="products" className="mb-3 font-semibold">
          Products
        </h2>
        <TableBox>
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Units</th>
                <th
                  className={`${th} text-right`}
                  title="Merchandise after the line's share of discounts, VAT incl."
                >
                  Sales
                </th>
                <th className={`${th} text-right`}>Share</th>
                <th
                  className={`${th} text-right`}
                  title="Ex. VAT, after discounts, minus cost at time of sale"
                >
                  Margin
                </th>
                <th className={`${th} text-right`}>Refunded</th>
                <th className={`${th} text-right`}>Available</th>
                <th className={`${th} text-right`} title="Available ÷ average daily units in this period">
                  Cover
                </th>
              </tr>
            </thead>
            <tbody>
              {a.products.map((p) => (
                <tr key={p.productId ?? p.name}>
                  <td className={td}>
                    {p.productId ? (
                      <Link href={`/admin/products/${p.productId}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{p.name}</span>
                    )}
                    <div className="text-xs text-fg-muted">{p.category}</div>
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{p.units}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{formatMoney(p.salesCents)}</td>
                  <td className={`${td} text-right`}>
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <span className="block h-full bg-fg" style={{ width: `${p.shareOfSales * 100}%` }} />
                      </span>
                      <span className="w-12 font-mono tabular-nums">{formatPercent(p.shareOfSales, 0)}</span>
                    </span>
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>
                    {p.marginCents === null ? "—" : formatMoney(p.marginCents)}
                    <div className="text-xs text-fg-muted">
                      {formatPercent(p.marginRate)}
                      {p.unitsWithoutCost > 0 && ` · ${p.unitsWithoutCost} u. no cost`}
                    </div>
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums text-fg-muted`}>
                    {p.refundedUnits || "—"}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{p.available ?? "—"}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{formatCover(p.coverDays)}</td>
                </tr>
              ))}
              {a.products.length === 0 && (
                <tr>
                  <td className={`${td} text-fg-muted`} colSpan={8}>
                    No paid orders in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableBox>
      </section>

      <div className="mb-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="categories">
          <h2 id="categories" className="mb-3 font-semibold">
            Categories
          </h2>
          <ul className="flex flex-col" role="list">
            {a.categories.map((cat) => {
              const total = a.categories.reduce((s, x) => s + x.salesCents, 0);
              const share = total ? cat.salesCents / total : 0;
              return (
                <li key={cat.name} className="flex flex-col gap-2 border-t border-line py-3">
                  <div className="flex justify-between text-sm">
                    <span>{cat.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(cat.salesCents)} · {cat.units} u.
                    </span>
                  </div>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span className="block h-full bg-fg" style={{ width: `${share * 100}%` }} />
                  </span>
                </li>
              );
            })}
            {a.categories.length === 0 && (
              <li className="border-t border-line py-3 text-sm text-fg-muted">No sales.</li>
            )}
          </ul>
        </section>
        <section aria-labelledby="stock-health">
          <h2 id="stock-health" className="mb-3 font-semibold">
            Stock right now
          </h2>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Value at cost", formatMoney(inv.valueAtCostCents), "Ex. VAT"],
              ["Value at retail", formatMoney(inv.valueAtRetailCents), "VAT incl."],
              ["Out of stock", `${inv.outOfStock} / ${inv.variants}`, "Active variants"],
              ["Low stock", String(inv.low), "At or below reorder point"],
              [
                "Dead stock",
                formatMoney(inv.deadStockCostCents),
                `${inv.deadStockVariants} ${inv.deadStockVariants === 1 ? "variant" : "variants"} unsold in 90 days`,
              ],
              ["Units on hand", formatUnits(inv.units), "Incl. held by orders"],
            ].map(([k, v, note]) => (
              <div key={k} className="rounded-card border border-line p-4">
                <dt className="label-mono text-fg-subtle">{k}</dt>
                <dd className="mt-1.5 font-mono text-lg tabular-nums">{v}</dd>
                <dd className="text-xs text-fg-muted">{note}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/admin/inventory?level=low"
            className="mt-3 inline-block text-sm text-fg-muted hover:text-fg"
          >
            See what to reorder →
          </Link>
        </section>
      </div>

      <details className="rounded-card border border-line p-5 text-sm text-fg-muted">
        <summary className="cursor-pointer font-medium text-fg">How these numbers are calculated</summary>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
          <li>
            A sale is an order paid within the period and now paid, shipped or delivered. Refunds are listed
            apart.
          </li>
          <li>Revenue is what customers paid: after discounts, VAT and shipping included.</li>
          <li>
            Net sales remove VAT (20 %) and shipping; discounts are spread over an order&apos;s lines by
            value.
          </li>
          <li>
            Margin = net sales − unit cost recorded on each order line when it was sold. Lines sold before a
            cost was set are counted separately and left out, so margins are never overstated.
          </li>
          <li>
            The comparison is with the period of the same length just before. Days are in Europe/Paris time.
          </li>
        </ul>
      </details>
    </>
  );
}

export default function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  return (
    <AdminGuard>
      <AnalyticsContent {...props} />
    </AdminGuard>
  );
}
