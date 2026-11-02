import Link from "next/link";
import { notFound } from "next/navigation";
import { getVariantLedger } from "@/server/inventory";
import { formatOrderNumber } from "@/server/orders";
import { formatCountNumber } from "@/server/stock-counts";
import { AdminHeader, Pager, TableBox, pageParam, td, th } from "@/components/admin/ui";
import { Kpi, LevelBadge } from "@/components/admin/metrics";
import { AdjustStockForm, VariantSettingsForm } from "@/components/admin/inventory-forms";
import { AdminGuard } from "@/components/admin/admin-guard";
import { formatMoney } from "@/lib/money";
import { stockLevel } from "@/lib/inventory";
import { cn } from "@/lib/cn";
import type { StockMovementReason } from "@/generated/prisma/enums";

export const metadata = { title: "Variant stock" };

const REASON_LABEL: Record<StockMovementReason, string> = {
  OPENING_BALANCE: "Opening balance",
  RECEIVED: "Received",
  ORDER_RESERVED: "Order reserved",
  ORDER_RELEASED: "Order released",
  RETURNED: "Customer return",
  DAMAGED: "Damaged / lost",
  ADJUSTMENT: "Correction",
  COUNT_CORRECTION: "Count correction",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

async function VariantContent({ params, searchParams }: PageProps<"/admin/inventory/[variantId]">) {
  const { variantId } = await params;
  const page = pageParam((await searchParams).page);
  const ledger = await getVariantLedger(variantId, page);
  if (!ledger) notFound();
  const { variant, movements } = ledger;
  const level = stockLevel(variant.stock, variant.reorderPoint, variant.isActive);

  return (
    <>
      <nav aria-label="Breadcrumb" className="label-mono mb-4 text-fg-subtle">
        <Link href="/admin/inventory" className="hover:text-fg">
          Inventory
        </Link>{" "}
        / {variant.sku}
      </nav>
      <AdminHeader
        title={`${variant.product.name} — ${variant.name}`}
        meta={variant.sku}
        action={
          <div className="flex items-center gap-3">
            <LevelBadge level={level} />
            <Link
              href={`/admin/products/${variant.product.id}`}
              className="text-sm text-fg-muted hover:text-fg"
            >
              Edit product →
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Available" value={variant.stock} note={`Reorder at ${variant.reorderPoint}`} />
        <Kpi
          label="Held by orders"
          value={ledger.reserved + ledger.toShip}
          note={`${ledger.reserved} unpaid · ${ledger.toShip} to ship`}
        />
        <Kpi label="On hand" value={ledger.onHand} note="What should be on the shelf" />
        <Kpi
          label="Value at cost"
          value={variant.costCents === null ? "—" : formatMoney(ledger.onHand * variant.costCents)}
          note={
            variant.costCents === null
              ? "No unit cost set"
              : `${formatMoney(variant.costCents)} per unit, ex. VAT`
          }
        />
      </div>

      <p
        className={cn(
          "mb-8 rounded-card border p-4 text-sm",
          ledger.reconciled ? "border-line text-fg-muted" : "border-warn text-warn",
        )}
        role={ledger.reconciled ? undefined : "alert"}
      >
        {ledger.reconciled
          ? `Ledger reconciled: ${ledger.total} movements add up to the current available stock (${variant.stock}).`
          : `Ledger mismatch: movements add up to ${ledger.ledgerSum}, but available stock is ${variant.stock}. Stock was changed outside the ledger; investigate before trusting these numbers.`}
      </p>

      <div className="mb-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="move" className="rounded-card border border-line p-6">
          <h2 id="move" className="mb-4 font-semibold">
            Record a movement
          </h2>
          <AdjustStockForm variantId={variant.id} />
        </section>
        <section aria-labelledby="settings" className="rounded-card border border-line p-6">
          <h2 id="settings" className="mb-4 font-semibold">
            Stock settings
          </h2>
          <VariantSettingsForm
            variantId={variant.id}
            reorderPoint={variant.reorderPoint}
            costCents={variant.costCents}
          />
        </section>
      </div>

      <section aria-labelledby="history">
        <h2 id="history" className="mb-3 font-semibold">
          Movements
        </h2>
        <TableBox>
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Reason</th>
                <th className={`${th} text-right`}>Change</th>
                <th className={`${th} text-right`}>Available after</th>
                <th className={th}>Reference</th>
                <th className={th}>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className={`${td} whitespace-nowrap text-fg-muted`}>{dateTime.format(m.createdAt)}</td>
                  <td className={td}>
                    {REASON_LABEL[m.reason]}
                    {m.note && <div className="text-xs text-fg-muted">{m.note}</div>}
                  </td>
                  <td
                    className={cn(
                      td,
                      "text-right font-mono tabular-nums",
                      m.delta > 0 ? "text-accent" : "text-fg",
                    )}
                  >
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{m.stockAfter}</td>
                  <td className={td}>
                    {m.order ? (
                      <Link href={`/admin/orders/${m.order.id}`} className="font-mono hover:underline">
                        {formatOrderNumber(m.order.number)}
                      </Link>
                    ) : m.count ? (
                      <Link
                        href={`/admin/inventory/counts/${m.count.id}`}
                        className="font-mono hover:underline"
                      >
                        {formatCountNumber(m.count.number)}
                      </Link>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className={`${td} text-fg-muted`}>
                    {m.actor?.name ?? (m.order ? "Checkout" : "System")}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td className={`${td} text-fg-muted`} colSpan={6}>
                    No movements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableBox>
        <Pager
          page={page}
          pageCount={ledger.pageCount}
          href={(p) => `/admin/inventory/${variant.id}?page=${p}`}
        />
      </section>
    </>
  );
}

export default function VariantStockPage(props: PageProps<"/admin/inventory/[variantId]">) {
  return (
    <AdminGuard>
      <VariantContent {...props} />
    </AdminGuard>
  );
}
