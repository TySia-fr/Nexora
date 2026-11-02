import { requireAdmin } from "@/server/session";
import { getInventory } from "@/server/inventory";
import { isAppError } from "@/server/errors";
import { inventoryFilterSchema } from "@/lib/validation/inventory";
import { toCsv } from "@/lib/inventory";

/**
 * Inventory as CSV, with the same filters as the page. Admin only: the role is checked
 * here too (route handlers don't go through AdminGuard). Cells are escaped against
 * spreadsheet formula injection (product names are admin-entered text).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    const status = isAppError(e) && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return new Response(status === 401 ? "Sign in required." : "Forbidden.", { status });
  }
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { rows } = await getInventory(inventoryFilterSchema.parse(params));
  const csv = toCsv(
    [
      "sku",
      "product",
      "variant",
      "category",
      "status",
      "available",
      "reserved",
      "to_ship",
      "on_hand",
      "reorder_point",
      "sold_30d",
      "cover_days",
      "unit_cost_eur",
      "price_eur",
      "value_at_cost_eur",
    ],
    rows.map((r) => [
      r.sku,
      r.productName,
      r.variantName,
      r.categoryName,
      r.level,
      r.available,
      r.reserved,
      r.toShip,
      r.onHand,
      r.reorderPoint,
      r.unitsSold30d,
      r.coverDays,
      r.costCents === null ? null : r.costCents / 100,
      r.priceCents / 100,
      r.costCents === null ? null : (r.onHand * r.costCents) / 100,
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexora-inventory-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
