import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCountNumber, getCount } from "@/server/stock-counts";
import { AdminHeader } from "@/components/admin/ui";
import { Kpi } from "@/components/admin/metrics";
import { CountSheet } from "@/components/admin/inventory-forms";
import { AdminGuard } from "@/components/admin/admin-guard";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Stock count" };

const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

async function CountContent({ params }: PageProps<"/admin/inventory/counts/[id]">) {
  const { id } = await params;
  const count = await getCount(id);
  if (!count) notFound();
  const { summary } = count;
  const open = count.status === "OPEN";
  return (
    <>
      <nav aria-label="Breadcrumb" className="label-mono mb-4 text-fg-subtle">
        <Link href="/admin/inventory/counts" className="hover:text-fg">
          Stock counts
        </Link>{" "}
        / {formatCountNumber(count.number)}
      </nav>
      <AdminHeader
        title={`Count ${formatCountNumber(count.number)}`}
        meta={`${count.category?.name ?? "All active variants"} · ${count.status.toLowerCase()}`}
      />
      <p className="mb-6 text-sm text-fg-muted">
        Opened {date.format(count.createdAt)} by {count.createdBy?.name ?? "—"}
        {count.closedAt &&
          ` · ${count.status === "COMMITTED" ? "committed" : "cancelled"} ${date.format(count.closedAt)} by ${count.closedBy?.name ?? "—"}`}
        {count.note && ` · ${count.note}`}
      </p>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Lines counted" value={`${summary.counted} / ${summary.lines}`} />
        <Kpi
          label="Net difference"
          value={`${summary.varianceUnits > 0 ? "+" : ""}${summary.varianceUnits} units`}
          note="Saved counts only"
        />
        <Kpi
          label="Difference at cost"
          value={formatMoney(summary.varianceCostCents)}
          note={summary.unknownCost ? `${summary.unknownCost} lines without a cost` : "Ex. VAT"}
        />
        <Kpi label="Lines to recount" value={summary.stale} note="Moved since frozen" />
      </div>
      <CountSheet
        countId={count.id}
        open={open}
        lines={count.lines.map((l) => ({
          id: l.id,
          sku: l.variant.sku,
          product: l.variant.product.name,
          variant: l.variant.name,
          expected: l.expected,
          counted: l.counted,
          stale: l.stale,
        }))}
      />
    </>
  );
}

export default function CountPage(props: PageProps<"/admin/inventory/counts/[id]">) {
  return (
    <AdminGuard>
      <CountContent {...props} />
    </AdminGuard>
  );
}
