import { beforeEach, describe, expect, it } from "vitest";
import { getAnalytics } from "@/server/analytics";
import { db, makeCategory, makeProduct, resetDatabase } from "./helpers";

type Line = {
  product: Awaited<ReturnType<typeof makeProduct>>;
  priceCents: number;
  quantity: number;
  costCents: number | null;
};

let n = 0;
async function order(opts: {
  lines: Line[];
  status: "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "DELIVERED" | "REFUNDED";
  paidAt: Date | null;
  discountCents?: number;
  shippingCents?: number;
}) {
  const subtotal = opts.lines.reduce((s, l) => s + l.priceCents * l.quantity, 0);
  const discount = opts.discountCents ?? 0;
  const shipping = opts.shippingCents ?? 0;
  return db.order.create({
    data: {
      email: `o${++n}@example.test`,
      status: opts.status,
      subtotalCents: subtotal,
      discountCents: discount,
      shippingCents: shipping,
      totalCents: subtotal - discount + shipping,
      shippingMethod: "STANDARD",
      shipFullName: "A",
      shipLine1: "B",
      shipPostalCode: "34000",
      shipCity: "Montpellier",
      shipCountry: "FR",
      paidAt: opts.paidAt,
      items: {
        create: opts.lines.map((l) => ({
          productId: l.product.id,
          variantId: l.product.variants[0]!.id,
          productSlug: l.product.slug,
          productName: l.product.name,
          variantName: "V",
          sku: l.product.variants[0]!.sku,
          unitPriceCents: l.priceCents,
          quantity: l.quantity,
          lineTotalCents: l.priceCents * l.quantity,
          unitCostCents: l.costCents,
        })),
      },
    },
  });
}

describe("sales analytics", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  let x: Awaited<ReturnType<typeof makeProduct>>;
  let y: Awaited<ReturnType<typeof makeProduct>>;

  beforeEach(async () => {
    await resetDatabase();
    const audio = await makeCategory("audio");
    const extras = await makeCategory("extras");
    x = await makeProduct({ categoryId: audio.id, name: "X", variants: [{ priceCents: 10000, stock: 12 }] });
    y = await makeProduct({ categoryId: extras.id, name: "Y", variants: [{ priceCents: 5000, stock: 0 }] });

    // Current period (7 days before `now`).
    await order({
      status: "DELIVERED",
      paidAt: new Date("2026-06-14T10:00:00Z"),
      discountCents: 2500,
      lines: [
        { product: x, priceCents: 10000, quantity: 2, costCents: 4000 },
        { product: y, priceCents: 5000, quantity: 1, costCents: null },
      ],
    });
    // 22:30 UTC is 00:30 the next day in Paris.
    await order({
      status: "SHIPPED",
      paidAt: new Date("2026-06-10T22:30:00Z"),
      shippingCents: 690,
      lines: [{ product: x, priceCents: 10000, quantity: 1, costCents: 4000 }],
    });
    await order({
      status: "REFUNDED",
      paidAt: new Date("2026-06-12T09:00:00Z"),
      lines: [{ product: x, priceCents: 10000, quantity: 1, costCents: 4000 }],
    });
    await order({
      status: "PENDING_PAYMENT",
      paidAt: null,
      lines: [{ product: x, priceCents: 10000, quantity: 5, costCents: 4000 }],
    });
    // Previous period.
    await order({
      status: "SHIPPED",
      paidAt: new Date("2026-06-05T09:00:00Z"),
      lines: [{ product: x, priceCents: 10000, quantity: 1, costCents: 4000 }],
    });
  });

  it("computes period totals exactly", async () => {
    const a = await getAnalytics(7, now);
    expect(a.current).toEqual({
      orders: 2,
      revenueCents: 33190,
      merchandiseCents: 35000,
      discountCents: 2500,
      shippingCents: 690,
      units: 4,
      cogsCents: 12000,
      unitsWithoutCost: 1,
      netSalesCents: 27083, // (35000 − 2500) / 1.2
      netSalesWithCostCents: 23333, // X lines after their discount share (18000 + 10000) / 1.2
      grossMarginCents: 11333,
      averageOrderCents: 16595,
      refundedOrders: 1,
      refundedCents: 10000,
    });
    expect(a.previous).toMatchObject({ orders: 1, revenueCents: 10000, units: 1 });
    expect(a.change.revenue).toBeCloseTo(231.9, 1);
  });

  it("attributes sales, discounts, margins and refunds to products", async () => {
    const { products } = await getAnalytics(7, now);
    expect(products.map((p) => p.name)).toEqual(["X", "Y"]);
    expect(products[0]).toMatchObject({
      units: 3,
      salesCents: 28000,
      marginCents: 11333,
      unitsWithoutCost: 0,
      refundedUnits: 1,
      available: 12,
      coverDays: 28, // 12 available / (3 units / 7 days)
    });
    expect(products[0]!.shareOfSales).toBeCloseTo(28000 / 32500, 6);
    expect(products[1]).toMatchObject({
      units: 1,
      salesCents: 4500,
      marginCents: null,
      unitsWithoutCost: 1,
      coverDays: 0,
    });
  });

  it("buckets days in the store's time zone and zero-fills gaps", async () => {
    const { series } = await getAnalytics(7, now);
    expect(series.map((p) => p.day)).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ]);
    const byDay = Object.fromEntries(series.map((p) => [p.day, p.revenueCents]));
    expect(byDay["2026-06-10"]).toBe(0);
    expect(byDay["2026-06-11"]).toBe(10690);
    expect(byDay["2026-06-14"]).toBe(22500);
    expect(byDay["2026-06-12"]).toBe(0); // refunded: not revenue
    expect(series.reduce((s, p) => s + p.revenueCents, 0)).toBe(33190);
  });

  it("values stock at cost and finds stock that hasn't sold", async () => {
    await db.productVariant.update({ where: { id: x.variants[0]!.id }, data: { costCents: 4000 } });
    const { inventory } = await getAnalytics(7, now);
    // 12 available + 0 held (the pending order was created directly, without reserving).
    expect(inventory).toMatchObject({ variants: 2, outOfStock: 1 });
    expect(inventory.valueAtCostCents).toBe((12 + 5) * 4000); // pending order's 5 units are held
  });

  it("counts stock unsold for 90 days as dead stock", async () => {
    await db.productVariant.update({ where: { id: x.variants[0]!.id }, data: { costCents: 4000 } });
    expect((await getAnalytics(7, now)).inventory).toMatchObject({
      deadStockVariants: 0,
      deadStockCostCents: 0,
    });
    const later = new Date("2026-10-01T12:00:00Z"); // X last sold mid-June
    expect((await getAnalytics(7, later)).inventory).toMatchObject({
      deadStockVariants: 1,
      deadStockCostCents: 17 * 4000,
    });
  });
});
