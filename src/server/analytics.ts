import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { daysOfCover, exVat, percentChange } from "@/lib/inventory";

/**
 * Sales analytics. Definitions (also shown in the admin UI):
 *
 * - A sale is an order that reached PAID (paidAt set) and is PAID, SHIPPED or DELIVERED.
 *   Refunded orders are reported separately and excluded from revenue.
 * - Revenue = what customers paid, VAT included (order totals, after discounts,
 *   including shipping).
 * - Net sales = merchandise after discounts, excluding VAT and shipping.
 * - Gross margin = net sales − cost of goods sold (unit cost snapshotted on each order
 *   line when it was sold). Lines sold without a known cost are counted and excluded,
 *   so the margin is never inflated by missing costs.
 * - Days are calendar days in Europe/Paris, where the store operates (timestamps are
 *   stored in UTC). Ranges longer than 90 days are grouped by week (Monday start).
 */

export const STORE_TIME_ZONE = "Europe/Paris";
const SOLD = Prisma.sql`o."status" IN ('PAID', 'SHIPPED', 'DELIVERED')`;

type PeriodTotals = {
  orders: number;
  revenueCents: number;
  merchandiseCents: number;
  discountCents: number;
  shippingCents: number;
  units: number;
  cogsCents: number;
  unitsWithoutCost: number;
  /** Merchandise after discounts, on lines whose cost is known, ex. VAT. */
  netSalesCents: number;
  netSalesWithCostCents: number;
  grossMarginCents: number;
  averageOrderCents: number;
  refundedOrders: number;
  refundedCents: number;
};

async function periodTotals(from: Date, to: Date): Promise<PeriodTotals> {
  const [orderRow] = await db.$queryRaw<
    {
      orders: bigint;
      revenue: bigint | null;
      merchandise: bigint | null;
      discount: bigint | null;
      shipping: bigint | null;
      refunded_orders: bigint;
      refunded: bigint | null;
    }[]
  >`
    SELECT
      COUNT(*) FILTER (WHERE ${SOLD}) AS orders,
      SUM(o."totalCents") FILTER (WHERE ${SOLD}) AS revenue,
      SUM(o."subtotalCents") FILTER (WHERE ${SOLD}) AS merchandise,
      SUM(o."discountCents") FILTER (WHERE ${SOLD}) AS discount,
      SUM(o."shippingCents") FILTER (WHERE ${SOLD}) AS shipping,
      COUNT(*) FILTER (WHERE o."status" = 'REFUNDED') AS refunded_orders,
      SUM(o."totalCents") FILTER (WHERE o."status" = 'REFUNDED') AS refunded
    FROM "Order" o
    WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to}
  `;
  // Discounts are order-level; each line carries its share in proportion to its value,
  // so margin per line (and per product) is after discounts. Integer maths in SQL.
  const [lineRow] = await db.$queryRaw<
    { units: bigint | null; cogs: bigint | null; no_cost: bigint | null; net_known: bigint | null }[]
  >`
    WITH lines AS (
      SELECT oi."quantity", oi."unitCostCents",
             oi."lineTotalCents" - ROUND(o."discountCents"::numeric * oi."lineTotalCents" / NULLIF(o."subtotalCents", 0)) AS net_incl
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE ${SOLD} AND o."paidAt" >= ${from} AND o."paidAt" < ${to}
    )
    SELECT SUM("quantity") AS units,
           SUM("quantity" * "unitCostCents") AS cogs,
           SUM("quantity") FILTER (WHERE "unitCostCents" IS NULL) AS no_cost,
           SUM(net_incl) FILTER (WHERE "unitCostCents" IS NOT NULL) AS net_known
    FROM lines
  `;
  const n = (v: bigint | null | undefined) => Number(v ?? 0);
  const orders = n(orderRow?.orders);
  const revenueCents = n(orderRow?.revenue);
  const merchandiseCents = n(orderRow?.merchandise);
  const discountCents = n(orderRow?.discount);
  const cogsCents = n(lineRow?.cogs);
  const netSalesCents = exVat(merchandiseCents - discountCents);
  const netSalesWithCostCents = exVat(n(lineRow?.net_known));
  return {
    orders,
    revenueCents,
    merchandiseCents,
    discountCents,
    shippingCents: n(orderRow?.shipping),
    units: n(lineRow?.units),
    cogsCents,
    unitsWithoutCost: n(lineRow?.no_cost),
    netSalesCents,
    netSalesWithCostCents,
    grossMarginCents: netSalesWithCostCents - cogsCents,
    averageOrderCents: orders > 0 ? Math.round(revenueCents / orders) : 0,
    refundedOrders: n(orderRow?.refunded_orders),
    refundedCents: n(orderRow?.refunded),
  };
}

export type SeriesPoint = { day: string; revenueCents: number; orders: number; units: number };

/** One point per day (or per week for long ranges), zero-filled, in the store's time zone. */
async function series(from: Date, to: Date, bucket: "day" | "week"): Promise<SeriesPoint[]> {
  const unit = bucket === "week" ? Prisma.sql`'week'` : Prisma.sql`'day'`;
  const step = bucket === "week" ? Prisma.sql`interval '1 week'` : Prisma.sql`interval '1 day'`;
  const rows = await db.$queryRaw<{ day: string; revenue: bigint; orders: bigint; units: bigint }[]>`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc(${unit}, (${from}::timestamp AT TIME ZONE 'UTC') AT TIME ZONE ${STORE_TIME_ZONE}),
        date_trunc(${unit}, ((${to}::timestamp - interval '1 microsecond') AT TIME ZONE 'UTC') AT TIME ZONE ${STORE_TIME_ZONE}),
        ${step}
      ) AS b
    ),
    sold AS (
      SELECT date_trunc(${unit}, o."paidAt" AT TIME ZONE 'UTC' AT TIME ZONE ${STORE_TIME_ZONE}) AS b,
             o."totalCents", (SELECT SUM(oi."quantity") FROM "OrderItem" oi WHERE oi."orderId" = o."id") AS units
      FROM "Order" o
      WHERE ${SOLD} AND o."paidAt" >= ${from} AND o."paidAt" < ${to}
    )
    SELECT to_char(buckets.b, 'YYYY-MM-DD') AS day,
           COALESCE(SUM(sold."totalCents"), 0) AS revenue,
           COUNT(sold.b) AS orders,
           COALESCE(SUM(sold.units), 0) AS units
    FROM buckets LEFT JOIN sold ON sold.b = buckets.b
    GROUP BY buckets.b ORDER BY buckets.b
  `;
  return rows.map((r) => ({
    day: r.day,
    revenueCents: Number(r.revenue),
    orders: Number(r.orders),
    units: Number(r.units),
  }));
}

export type ProductPerformance = {
  productId: string | null;
  slug: string | null;
  name: string;
  category: string;
  units: number;
  /** Merchandise incl. VAT, after the line's share of order discounts. */
  salesCents: number;
  shareOfSales: number;
  /** Ex. VAT, after discounts, minus cost; null when no line had a known cost. */
  marginCents: number | null;
  marginRate: number | null;
  unitsWithoutCost: number;
  refundedUnits: number;
  available: number | null;
  coverDays: number | null;
};

async function productPerformance(from: Date, to: Date, days: number): Promise<ProductPerformance[]> {
  const rows = await db.$queryRaw<
    {
      product_id: string | null;
      slug: string | null;
      name: string;
      category: string | null;
      units: bigint;
      sales: bigint;
      net_known: bigint | null;
      cogs: bigint | null;
      no_cost: bigint | null;
      refunded_units: bigint | null;
      available: bigint | null;
    }[]
  >`
    WITH lines AS (
      SELECT oi."productId", oi."productSlug", oi."productName", oi."quantity", oi."unitCostCents", o."status",
             oi."lineTotalCents" - ROUND(o."discountCents"::numeric * oi."lineTotalCents" / NULLIF(o."subtotalCents", 0)) AS net_incl
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."paidAt" >= ${from} AND o."paidAt" < ${to}
        AND o."status" IN ('PAID', 'SHIPPED', 'DELIVERED', 'REFUNDED')
    )
    SELECT l."productId" AS product_id,
           MAX(l."productSlug") AS slug,
           COALESCE(MAX(p."name"), MAX(l."productName")) AS name,
           MAX(c."name") AS category,
           COALESCE(SUM(l."quantity") FILTER (WHERE l."status" <> 'REFUNDED'), 0) AS units,
           COALESCE(SUM(l.net_incl) FILTER (WHERE l."status" <> 'REFUNDED'), 0) AS sales,
           SUM(l.net_incl) FILTER (WHERE l."status" <> 'REFUNDED' AND l."unitCostCents" IS NOT NULL) AS net_known,
           SUM(l."quantity" * l."unitCostCents") FILTER (WHERE l."status" <> 'REFUNDED') AS cogs,
           SUM(l."quantity") FILTER (WHERE l."status" <> 'REFUNDED' AND l."unitCostCents" IS NULL) AS no_cost,
           SUM(l."quantity") FILTER (WHERE l."status" = 'REFUNDED') AS refunded_units,
           (SELECT SUM(v."stock") FROM "ProductVariant" v WHERE v."productId" = l."productId" AND v."isActive") AS available
    FROM lines l
    LEFT JOIN "Product" p ON p."id" = l."productId"
    LEFT JOIN "Category" c ON c."id" = p."categoryId"
    GROUP BY l."productId"
    ORDER BY sales DESC, units DESC
  `;
  const total = rows.reduce((s, r) => s + Number(r.sales), 0);
  return rows.map((r) => {
    const units = Number(r.units);
    const netKnown = r.net_known === null ? null : exVat(Number(r.net_known));
    const marginCents = netKnown === null ? null : netKnown - Number(r.cogs ?? 0);
    const available = r.available === null ? null : Number(r.available);
    return {
      productId: r.product_id,
      slug: r.slug,
      name: r.name,
      category: r.category ?? "—",
      units,
      salesCents: Number(r.sales),
      shareOfSales: total > 0 ? Number(r.sales) / total : 0,
      marginCents,
      marginRate: marginCents !== null && netKnown ? marginCents / netKnown : null,
      unitsWithoutCost: Number(r.no_cost ?? 0),
      refundedUnits: Number(r.refunded_units ?? 0),
      available,
      coverDays: available === null ? null : daysOfCover(available, units, days),
    };
  });
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

export async function getAnalytics(days: number, now = new Date()) {
  const to = now;
  const from = new Date(now.getTime() - days * 86_400_000);
  const previousFrom = new Date(from.getTime() - days * 86_400_000);
  const [current, previous, points, products, inventory] = await Promise.all([
    periodTotals(from, to),
    periodTotals(previousFrom, from),
    series(from, to, days > 90 ? "week" : "day"),
    productPerformance(from, to, days),
    inventoryHealth(now),
  ]);
  const change = {
    revenue: percentChange(current.revenueCents, previous.revenueCents),
    orders: percentChange(current.orders, previous.orders),
    units: percentChange(current.units, previous.units),
    averageOrder: percentChange(current.averageOrderCents, previous.averageOrderCents),
    grossMargin: percentChange(current.grossMarginCents, previous.grossMarginCents),
  };
  const categories = new Map<string, { salesCents: number; units: number }>();
  for (const p of products) {
    const c = categories.get(p.category) ?? { salesCents: 0, units: 0 };
    c.salesCents += p.salesCents;
    c.units += p.units;
    categories.set(p.category, c);
  }
  return {
    range: { days, from, to, bucket: days > 90 ? ("week" as const) : ("day" as const) },
    current,
    previous,
    change,
    series: points,
    products,
    categories: [...categories.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.salesCents - a.salesCents),
    inventory,
  };
}

/** Stock health right now: how much is tied up, and where. */
async function inventoryHealth(now: Date) {
  const [row] = await db.$queryRaw<
    {
      variants: bigint;
      out_of_stock: bigint;
      low: bigint;
      units: bigint | null;
      value_cost: bigint | null;
      value_retail: bigint | null;
      dead_value_cost: bigint | null;
      dead_variants: bigint;
    }[]
  >`
    WITH held AS (
      SELECT oi."variantId", SUM(oi."quantity") AS units
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" IN ('PENDING_PAYMENT', 'PAID') GROUP BY oi."variantId"
    ),
    recent AS (
      SELECT DISTINCT oi."variantId" FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE ${SOLD} AND o."paidAt" >= ${new Date(now.getTime() - 90 * 86_400_000)}
    ),
    v AS (
      SELECT v.*, v."stock" + COALESCE(h.units, 0) AS on_hand, (r."variantId" IS NOT NULL) AS sold_recently
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId" AND p."status" <> 'ARCHIVED'
      LEFT JOIN held h ON h."variantId" = v."id"
      LEFT JOIN recent r ON r."variantId" = v."id"
      WHERE v."isActive"
    )
    SELECT COUNT(*) AS variants,
           COUNT(*) FILTER (WHERE "stock" = 0) AS out_of_stock,
           COUNT(*) FILTER (WHERE "stock" > 0 AND "stock" <= "reorderPoint") AS low,
           SUM(on_hand) AS units,
           SUM(on_hand * "costCents") AS value_cost,
           SUM(on_hand * "priceCents") AS value_retail,
           SUM(on_hand * "costCents") FILTER (WHERE NOT sold_recently AND on_hand > 0) AS dead_value_cost,
           COUNT(*) FILTER (WHERE NOT sold_recently AND on_hand > 0) AS dead_variants
    FROM v
  `;
  const n = (x: bigint | null | undefined) => Number(x ?? 0);
  return {
    variants: n(row?.variants),
    outOfStock: n(row?.out_of_stock),
    low: n(row?.low),
    units: n(row?.units),
    valueAtCostCents: n(row?.value_cost),
    valueAtRetailCents: n(row?.value_retail),
    /** On hand but not sold in 90 days. */
    deadStockCostCents: n(row?.dead_value_cost),
    deadStockVariants: n(row?.dead_variants),
  };
}
