import Link from "next/link";
import { formatCountNumber, listCounts } from "@/server/stock-counts";
import { listCategoriesAdmin } from "@/server/admin";
import { AdminHeader, TableBox, td, th } from "@/components/admin/ui";
import { OpenCountForm } from "@/components/admin/inventory-forms";
import { AdminGuard } from "@/components/admin/admin-guard";
import { cn } from "@/lib/cn";

export const metadata = { title: "Stock counts" };

const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const STATUS_STYLE = {
  OPEN: "border-accent text-accent",
  COMMITTED: "border-line-strong text-fg-muted",
  CANCELLED: "border-line text-fg-subtle",
} as const;

async function CountsContent() {
  const [counts, categories] = await Promise.all([listCounts(), listCategoriesAdmin()]);
  const open = counts.find((c) => c.status === "OPEN");
  return (
    <>
      <AdminHeader title="Stock counts" meta="Physical stock-takes" />
      <section aria-labelledby="new-count" className="mb-8 rounded-card border border-line p-6">
        <h2 id="new-count" className="mb-1 font-semibold">
          New count
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-fg-muted">
          Freezes, for each variant, the units that should be on the shelf (available plus units held by
          orders not shipped yet). Count the shelf, enter what you find, then commit: each difference becomes
          a count correction in the ledger. Sales during the count don&apos;t affect it; shipments and
          deliveries do, and those lines are flagged for a recount.
        </p>
        {open ? (
          <p className="text-sm">
            <Link
              href={`/admin/inventory/counts/${open.id}`}
              className="font-medium underline underline-offset-4"
            >
              {formatCountNumber(open.number)}
            </Link>{" "}
            is open. Finish or cancel it before starting another.
          </p>
        ) : (
          <OpenCountForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
        )}
      </section>

      <TableBox>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Count</th>
              <th className={th}>Scope</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Counted</th>
              <th className={th}>Opened</th>
              <th className={th}>By</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => {
              const counted = c.lines.filter((l) => l.counted !== null).length;
              return (
                <tr key={c.id}>
                  <td className={td}>
                    <Link
                      href={`/admin/inventory/counts/${c.id}`}
                      className="font-mono font-medium hover:underline"
                    >
                      {formatCountNumber(c.number)}
                    </Link>
                    {c.note && <div className="text-xs text-fg-muted">{c.note}</div>}
                  </td>
                  <td className={td}>{c.category?.name ?? "All active variants"}</td>
                  <td className={td}>
                    <span
                      className={cn(
                        "label-mono rounded-full border px-2 py-1 text-[10px]",
                        STATUS_STYLE[c.status],
                      )}
                    >
                      {c.status.toLowerCase()}
                    </span>
                  </td>
                  <td className={`${td} text-right font-mono tabular-nums`}>
                    {counted} / {c.lines.length}
                  </td>
                  <td className={`${td} text-fg-muted`}>{date.format(c.createdAt)}</td>
                  <td className={`${td} text-fg-muted`}>{c.createdBy?.name ?? "—"}</td>
                </tr>
              );
            })}
            {counts.length === 0 && (
              <tr>
                <td className={`${td} text-fg-muted`} colSpan={6}>
                  No counts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableBox>
    </>
  );
}

export default function CountsPage() {
  return (
    <AdminGuard>
      <CountsContent />
    </AdminGuard>
  );
}
