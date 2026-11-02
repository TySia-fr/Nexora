import Link from "next/link";
import { getInventory } from "@/server/inventory";
import { getCategories } from "@/server/catalog";
import { AdminHeader, TableBox, td, th } from "@/components/admin/ui";
import { Kpi, LevelBadge, formatCover, formatUnits } from "@/components/admin/metrics";
import { AdminGuard } from "@/components/admin/admin-guard";
import { buttonClasses } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { INVENTORY_LEVELS, INVENTORY_SORTS, inventoryFilterSchema } from "@/lib/validation/inventory";

export const metadata = { title: "Inventory" };

const LEVEL_LABEL: Record<(typeof INVENTORY_LEVELS)[number], string> = {
  all: "All",
  out: "Out of stock",
  low: "Low",
  ok: "In stock",
  inactive: "Inactive",
};
const SORT_LABEL: Record<(typeof INVENTORY_SORTS)[number], string> = {
  urgency: "Most urgent",
  name: "Name",
  available: "Available, lowest first",
  sold: "Sold in 30 days",
  value: "Value at cost",
};

async function InventoryContent({ searchParams }: PageProps<"/admin/inventory">) {
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  const filter = inventoryFilterSchema.parse(flat);
  const [{ rows, totals }, categories] = await Promise.all([getInventory(filter), getCategories()]);
  const counts = { out: 0, low: 0 };
  for (const r of rows) if (r.level === "out" || r.level === "low") counts[r.level]++;
  const href = (patch: Partial<typeof filter>) => {
    const next = { ...filter, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.category) p.set("category", next.category);
    if (next.level !== "all") p.set("level", next.level);
    if (next.sort !== "urgency") p.set("sort", next.sort);
    const s = p.toString();
    return `/admin/inventory${s ? `?${s}` : ""}`;
  };
  const exportHref = href({}).replace("/admin/inventory", "/admin/inventory/export");

  return (
    <>
      <AdminHeader
        title="Inventory"
        meta={`${rows.length} variants`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={exportHref} className={buttonClasses("secondary", "sm")} download>
              Export CSV
            </a>
            <Link href="/admin/inventory/counts" className={buttonClasses("inverse", "sm")}>
              Stock counts
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Units on hand"
          value={formatUnits(totals.onHand)}
          note="Available + held by unshipped orders"
        />
        <Kpi
          label="Value at cost"
          value={formatMoney(totals.valueAtCostCents)}
          note={totals.unknownCost > 0 ? `${totals.unknownCost} variants without a cost` : "Ex. VAT"}
        />
        <Kpi label="Value at retail" value={formatMoney(totals.valueAtRetailCents)} note="VAT included" />
        <Kpi
          label="Needs attention"
          value={`${counts.out} out · ${counts.low} low`}
          note="At or below reorder point"
        />
      </div>

      <nav aria-label="Stock level" className="mb-4 flex flex-wrap gap-1.5">
        {INVENTORY_LEVELS.map((l) => (
          <Link
            key={l}
            href={href({ level: l })}
            aria-current={filter.level === l ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm",
              filter.level === l
                ? "border-fg bg-fg text-canvas"
                : "border-line-strong text-fg-muted hover:border-fg",
            )}
          >
            {LEVEL_LABEL[l]}
          </Link>
        ))}
      </nav>

      <form method="get" className="mb-6 flex flex-wrap gap-2">
        {filter.level !== "all" && <input type="hidden" name="level" value={filter.level} />}
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={filter.q}
          placeholder="SKU or product"
          className={`${inputBase} h-11 w-56`}
        />
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={filter.category ?? ""}
          className={`${inputBase} h-11`}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <label htmlFor="sort" className="sr-only">
          Sort
        </label>
        <select id="sort" name="sort" defaultValue={filter.sort} className={`${inputBase} h-11`}>
          {INVENTORY_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary", "sm", "rounded-input")}>
          Apply
        </button>
      </form>

      <TableBox>
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <caption className="sr-only">
            Stock by variant. Available can be sold now; held units belong to orders not shipped yet.
          </caption>
          <thead>
            <tr>
              <th className={th}>Variant</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Available</th>
              <th className={`${th} text-right`} title="Unpaid orders (30-minute reservation)">
                Reserved
              </th>
              <th className={`${th} text-right`} title="Paid, not shipped">
                To ship
              </th>
              <th className={`${th} text-right`}>On hand</th>
              <th className={`${th} text-right`}>Reorder at</th>
              <th className={`${th} text-right`}>Sold 30 d</th>
              <th className={`${th} text-right`} title="Available ÷ average daily sales over 30 days">
                Cover
              </th>
              <th className={`${th} text-right`}>Value at cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variantId} className="hover:bg-fg/[0.02]">
                <td className={td}>
                  <Link href={`/admin/inventory/${r.variantId}`} className="font-medium hover:underline">
                    {r.productName}
                  </Link>
                  <div className="text-xs text-fg-muted">
                    {r.variantName} · <span className="font-mono">{r.sku}</span>
                  </div>
                </td>
                <td className={td}>
                  <LevelBadge level={r.level} />
                </td>
                <td className={`${td} text-right font-mono tabular-nums`}>{r.available}</td>
                <td className={`${td} text-right font-mono tabular-nums text-fg-muted`}>
                  {r.reserved || "—"}
                </td>
                <td className={`${td} text-right font-mono tabular-nums text-fg-muted`}>{r.toShip || "—"}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{r.onHand}</td>
                <td className={`${td} text-right font-mono tabular-nums text-fg-muted`}>{r.reorderPoint}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{r.unitsSold30d}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{formatCover(r.coverDays)}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>
                  {r.costCents === null ? (
                    <span className="text-fg-subtle" title="No unit cost set">
                      —
                    </span>
                  ) : (
                    formatMoney(r.onHand * r.costCents)
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={`${td} text-fg-muted`} colSpan={10}>
                  No variants match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableBox>
      <p className="mt-4 text-xs text-fg-subtle">
        Cover = available units ÷ average daily units sold over the last 30 days. “—” means nothing sold in
        that window, so there is no rate to project from.
      </p>
    </>
  );
}

export default function InventoryPage(props: PageProps<"/admin/inventory">) {
  return (
    <AdminGuard>
      <InventoryContent {...props} />
    </AdminGuard>
  );
}
