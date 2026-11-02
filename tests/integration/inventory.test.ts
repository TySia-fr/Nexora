import { beforeEach, describe, expect, it } from "vitest";
import { addToCart, type CartOwner } from "@/server/cart";
import { cancelPendingOrder, createOrderFromCart, markOrderPaid, transitionOrder } from "@/server/orders";
import { adjustStock, getInventory, getVariantLedger, updateVariantSettings } from "@/server/inventory";
import {
  cancelCount,
  commitCount,
  getCount,
  openCount,
  recordCounts,
  refreshStaleLines,
} from "@/server/stock-counts";
import { AppError } from "@/server/errors";
import {
  db,
  makeCategory,
  makeProduct,
  makeUser,
  resetDatabase,
  unreconciled,
  validCheckout,
} from "./helpers";

const guest = (): CartOwner => ({ guestToken: crypto.randomUUID() });
const ALL = { level: "all", sort: "name" } as const;

async function expectAppError(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

async function checkout(variantId: string, quantity: number) {
  const owner = guest();
  await addToCart(owner, variantId, quantity);
  return createOrderFromCart(owner, validCheckout(), null);
}

async function pay(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await db.$transaction((tx) =>
    markOrderPaid(
      tx,
      orderId,
      { sessionId: `cs_${orderId}`, intentId: null, amountCents: order.totalCents, currency: "EUR" },
      null,
    ),
  );
}

async function stockOf(variantId: string) {
  return (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
}

describe("stock ledger", () => {
  let categoryId: string;
  let adminId: string;
  beforeEach(async () => {
    await resetDatabase();
    categoryId = (await makeCategory("audio")).id;
    adminId = (await makeUser("ADMIN")).id;
  });

  it("records every change, linked to its order, and always reconciles", async () => {
    const p = await makeProduct({
      categoryId,
      variants: [{ priceCents: 10000, stock: 10, costCents: 4000 }],
    });
    const v = p.variants[0]!.id;

    const kept = await checkout(v, 2);
    const abandoned = await checkout(v, 3);
    await db.$transaction((tx) => cancelPendingOrder(tx, abandoned.id, "EXPIRED"));
    await adjustStock(adminId, { variantId: v, reason: "RECEIVED", quantity: 20, note: "PO-1" });
    await adjustStock(adminId, { variantId: v, reason: "DAMAGED", quantity: 1, note: "Dropped" });

    const moves = await db.stockMovement.findMany({ where: { variantId: v }, orderBy: { createdAt: "asc" } });
    expect(moves.map((m) => [m.reason, m.delta, m.stockAfter])).toEqual([
      ["OPENING_BALANCE", 10, 10],
      ["ORDER_RESERVED", -2, 8],
      ["ORDER_RESERVED", -3, 5],
      ["ORDER_RELEASED", 3, 8],
      ["RECEIVED", 20, 28],
      ["DAMAGED", -1, 27],
    ]);
    expect(moves[1]!.orderId).toBe(kept.id);
    expect(moves[2]!.orderId).toBe(abandoned.id);
    expect(moves[3]!.orderId).toBe(abandoned.id);
    expect(await stockOf(v)).toBe(27);
    expect(await unreconciled()).toEqual([]);

    const ledger = await getVariantLedger(v);
    expect(ledger).toMatchObject({ reconciled: true, reserved: 2, toShip: 0, onHand: 29 });
  });

  it("snapshots the unit cost on order lines, so later cost changes don't rewrite margins", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 12000, stock: 5, costCents: 5000 }] });
    const order = await checkout(p.variants[0]!.id, 1);
    await updateVariantSettings(adminId, { variantId: p.variants[0]!.id, reorderPoint: 3, costCents: "70" });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.unitCostCents).toBe(5000);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).costCents).toBe(
      7000,
    );
  });

  it("validates manual movements", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 2 }] });
    const v = p.variants[0]!.id;
    await expectAppError(
      adjustStock(adminId, { variantId: v, reason: "RECEIVED", quantity: -5 }),
      "VALIDATION",
    );
    await expectAppError(
      adjustStock(adminId, { variantId: v, reason: "ADJUSTMENT", quantity: 1 }),
      "VALIDATION",
    ); // note required
    await expectAppError(
      adjustStock(adminId, { variantId: v, reason: "DAMAGED", quantity: 3 }),
      "VALIDATION",
    ); // below zero
    await expectAppError(adjustStock(adminId, { variantId: v, reason: "NOPE", quantity: 1 }), "VALIDATION");
    await expectAppError(
      adjustStock(adminId, { variantId: "missing", reason: "RECEIVED", quantity: 1 }),
      "NOT_FOUND",
    );
    expect(await stockOf(v)).toBe(2);
    expect(await unreconciled()).toEqual([]);
  });

  it("never oversells under concurrent write-offs", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 3 }] });
    const v = p.variants[0]!.id;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => adjustStock(adminId, { variantId: v, reason: "DAMAGED", quantity: 1 })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stockOf(v)).toBe(0);
    expect(await db.stockMovement.count({ where: { variantId: v, reason: "DAMAGED" } })).toBe(3);
    expect(await unreconciled()).toEqual([]);
  });

  it("reports available, held and on-hand units, levels and cover", async () => {
    const p = await makeProduct({
      categoryId,
      variants: [
        { priceCents: 10000, stock: 10, costCents: 3000 },
        { priceCents: 10000, stock: 0 },
      ],
    });
    const [a, b] = p.variants;
    const unpaid = await checkout(a!.id, 1);
    const paid = await checkout(a!.id, 3);
    await pay(paid.id);
    await updateVariantSettings(adminId, { variantId: a!.id, reorderPoint: 6, costCents: "30" });

    const { rows, totals } = await getInventory(ALL);
    const ra = rows.find((r) => r.variantId === a!.id)!;
    expect(ra).toMatchObject({
      available: 6,
      reserved: 1,
      toShip: 3,
      onHand: 10,
      level: "low",
      unitsSold30d: 3,
    });
    expect(ra.coverDays).toBe(60); // 6 available / (3 sold / 30 days)
    expect(rows.find((r) => r.variantId === b!.id)).toMatchObject({ level: "out", coverDays: 0 });
    expect(totals).toMatchObject({ onHand: 10, valueAtCostCents: 30000, unknownCost: 0 });
    expect(unpaid.id).toBeTruthy();

    expect((await getInventory({ ...ALL, level: "out" })).rows.map((r) => r.variantId)).toEqual([b!.id]);
  });
});

describe("stock counts", () => {
  let categoryId: string;
  let adminId: string;
  beforeEach(async () => {
    await resetDatabase();
    categoryId = (await makeCategory("audio")).id;
    adminId = (await makeUser("ADMIN")).id;
  });

  async function lineFor(countId: string, variantId: string) {
    return db.stockCountLine.findFirstOrThrow({ where: { countId, variantId } });
  }

  it("expects units held by unshipped orders to be on the shelf, and ignores sales during the count", async () => {
    const p = await makeProduct({
      categoryId,
      variants: [{ priceCents: 10000, stock: 10, costCents: 4000 }],
    });
    const v = p.variants[0]!.id;
    const paid = await checkout(v, 2);
    await pay(paid.id); // 8 available + 2 waiting to ship = 10 on the shelf

    const countId = await openCount(adminId, {});
    expect((await lineFor(countId, v)).expected).toBe(10);

    await checkout(v, 1); // a sale while counting: still on the shelf, not a difference
    const line = await lineFor(countId, v);
    await recordCounts(adminId, { countId, entries: [{ lineId: line.id, counted: "9" }] });

    const before = await getCount(countId);
    expect(before!.summary).toMatchObject({
      counted: 1,
      varianceUnits: -1,
      varianceCostCents: -4000,
      stale: 0,
    });

    expect(await commitCount(adminId, countId)).toEqual({ corrected: 1, skipped: 0 });
    expect(await stockOf(v)).toBe(6); // 8 − 1 sold during the count − 1 missing
    const correction = await db.stockMovement.findFirstOrThrow({ where: { reason: "COUNT_CORRECTION" } });
    expect(correction).toMatchObject({ delta: -1, countId, actorId: adminId });
    expect(await unreconciled()).toEqual([]);
  });

  it("commits once, skips uncounted lines and can be cancelled", async () => {
    const p = await makeProduct({
      categoryId,
      variants: [
        { priceCents: 100, stock: 5 },
        { priceCents: 100, stock: 7 },
      ],
    });
    const countId = await openCount(adminId, { categoryId });
    await expectAppError(openCount(adminId, {}), "CONFLICT"); // one open count at a time
    const l0 = await lineFor(countId, p.variants[0]!.id);
    await recordCounts(adminId, { countId, entries: [{ lineId: l0.id, counted: "8" }] });

    const [first, second] = await Promise.allSettled([
      commitCount(adminId, countId),
      commitCount(adminId, countId),
    ]);
    expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
    expect(await stockOf(p.variants[0]!.id)).toBe(8);
    expect(await stockOf(p.variants[1]!.id)).toBe(7); // not counted, not touched
    await expectAppError(recordCounts(adminId, { countId, entries: [] }), "CONFLICT");

    const next = await openCount(adminId, {});
    await cancelCount(adminId, next);
    await expectAppError(commitCount(adminId, next), "CONFLICT");
    expect(await unreconciled()).toEqual([]);
  });

  it("only updates lines of its own count", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 5 }] });
    const first = await openCount(adminId, {});
    const foreign = await lineFor(first, p.variants[0]!.id);
    await cancelCount(adminId, first);
    const second = await openCount(adminId, {});
    expect(
      await recordCounts(adminId, { countId: second, entries: [{ lineId: foreign.id, counted: "1" }] }),
    ).toBe(0);
    expect((await lineFor(second, p.variants[0]!.id)).counted).toBeNull();
  });

  it("flags lines that moved after being frozen, and refreshes them for a recount", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 5 }] });
    const v = p.variants[0]!.id;
    const shipped = await checkout(v, 1);
    await pay(shipped.id);
    const countId = await openCount(adminId, {});
    const line = await lineFor(countId, v);
    await recordCounts(adminId, { countId, entries: [{ lineId: line.id, counted: "5" }] });

    await new Promise((r) => setTimeout(r, 5));
    await adjustStock(adminId, { variantId: v, reason: "RECEIVED", quantity: 4 });
    await transitionOrder(shipped.id, "SHIPPED", adminId);
    expect((await getCount(countId))!.summary.stale).toBe(1);

    expect(await refreshStaleLines(adminId, countId)).toBe(1);
    const refreshed = await lineFor(countId, v);
    expect(refreshed).toMatchObject({ expected: 8, counted: null }); // 4 + 4 received, shipped unit gone
    expect((await getCount(countId))!.summary.stale).toBe(0);
  });

  it("refuses a correction that would take available stock below zero", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 3 }] });
    const v = p.variants[0]!.id;
    await pay((await checkout(v, 3)).id); // 0 available, 3 waiting to ship
    const countId = await openCount(adminId, {});
    const line = await lineFor(countId, v);
    await recordCounts(adminId, { countId, entries: [{ lineId: line.id, counted: "1" }] });
    await expectAppError(commitCount(adminId, countId), "CONFLICT");
    // The whole commit rolled back: still open, stock unchanged.
    expect((await db.stockCount.findUniqueOrThrow({ where: { id: countId } })).status).toBe("OPEN");
    expect(await stockOf(v)).toBe(0);
  });
});
