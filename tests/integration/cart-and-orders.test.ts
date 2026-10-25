import { beforeEach, describe, expect, it } from "vitest";
import {
  addToCart,
  applyCoupon,
  getCart,
  mergeGuestCart,
  removeLine,
  setLineQuantity,
  type CartOwner,
} from "@/server/cart";
import {
  canTransition,
  createOrderFromCart,
  releaseExpiredReservations,
  transitionOrder,
} from "@/server/orders";
import { AppError } from "@/server/errors";
import { db, makeCategory, makeProduct, makeUser, resetDatabase, validCheckout } from "./helpers";

const guest = (token = crypto.randomUUID()): CartOwner => ({ guestToken: token });

async function expectAppError(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("cart", () => {
  let categoryId: string;
  beforeEach(async () => {
    await resetDatabase();
    categoryId = (await makeCategory("audio")).id;
  });

  it("adds items, combines quantities and caps them at stock", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 5000, stock: 3 }] });
    const owner = guest();
    expect(await addToCart(owner, p.variants[0]!.id, 2)).toBe(2);
    expect(await addToCart(owner, p.variants[0]!.id, 5)).toBe(3);
    await expectAppError(addToCart(owner, p.variants[0]!.id, 1), "OUT_OF_STOCK");
    const cart = await getCart(owner);
    expect(cart.itemCount).toBe(3);
    expect(cart.totals.subtotalCents).toBe(15000);
  });

  it("rejects invalid quantities", async () => {
    const p = await makeProduct({ categoryId });
    for (const qty of [0, -1, 1.5, 11, Number.NaN]) {
      await expectAppError(addToCart(guest(), p.variants[0]!.id, qty), "VALIDATION");
    }
  });

  it("refuses out-of-stock, inactive and draft products", async () => {
    const out = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 0 }] });
    const inactive = await makeProduct({
      categoryId,
      variants: [{ priceCents: 100, stock: 5, isActive: false }],
    });
    const draft = await makeProduct({ categoryId, status: "DRAFT" });
    await expectAppError(addToCart(guest(), out.variants[0]!.id, 1), "OUT_OF_STOCK");
    await expectAppError(addToCart(guest(), inactive.variants[0]!.id, 1), "UNAVAILABLE");
    await expectAppError(addToCart(guest(), draft.variants[0]!.id, 1), "UNAVAILABLE");
    await expectAppError(addToCart(guest(), "nonexistent", 1), "UNAVAILABLE");
  });

  it("uses current database prices, not the price when the item was added", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 5000, stock: 5 }] });
    const owner = guest();
    await addToCart(owner, p.variants[0]!.id, 1);
    await db.productVariant.update({ where: { id: p.variants[0]!.id }, data: { priceCents: 6500 } });
    expect((await getCart(owner)).totals.subtotalCents).toBe(6500);
  });

  it("flags lines that became unavailable and leaves them out of the total", async () => {
    const a = await makeProduct({ categoryId, variants: [{ priceCents: 5000, stock: 5 }] });
    const b = await makeProduct({ categoryId, variants: [{ priceCents: 7000, stock: 5 }] });
    const owner = guest();
    await addToCart(owner, a.variants[0]!.id, 3);
    await addToCart(owner, b.variants[0]!.id, 1);
    await db.productVariant.update({ where: { id: a.variants[0]!.id }, data: { stock: 2 } });
    await db.product.update({ where: { id: b.id }, data: { status: "ARCHIVED" } });
    const cart = await getCart(owner);
    expect(cart.lines.map((l) => l.issue)).toEqual(["insufficient_stock", "unavailable"]);
    expect(cart.hasIssues).toBe(true);
    expect(cart.totals.subtotalCents).toBe(0);
  });

  it("does not let one cart modify another cart's lines (IDOR)", async () => {
    const p = await makeProduct({ categoryId });
    const alice = guest();
    const mallory = guest();
    await addToCart(alice, p.variants[0]!.id, 1);
    const lineId = (await getCart(alice)).lines[0]!.id;
    await expectAppError(setLineQuantity(mallory, lineId, 5), "NOT_FOUND");
    await expectAppError(removeLine(mallory, lineId), "NOT_FOUND");
    expect((await getCart(alice)).lines[0]!.quantity).toBe(1);
  });

  it("validates coupons before storing them", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 5000, stock: 5 }] });
    const owner = guest();
    await expectAppError(applyCoupon(owner, "NEXORA10"), "CART_EMPTY");
    await addToCart(owner, p.variants[0]!.id, 1);
    await db.coupon.create({ data: { code: "BIG", type: "PERCENT", value: 10, minSubtotalCents: 10000 } });
    await db.coupon.create({
      data: { code: "OLD", type: "PERCENT", value: 10, endsAt: new Date("2020-01-01") },
    });
    await db.coupon.create({ data: { code: "TENOFF", type: "PERCENT", value: 10 } });
    await expectAppError(applyCoupon(owner, "NOPE"), "COUPON_REJECTED");
    await expectAppError(applyCoupon(owner, "BIG"), "COUPON_REJECTED");
    await expectAppError(applyCoupon(owner, "OLD"), "COUPON_REJECTED");
    await expectAppError(applyCoupon(owner, "'; DROP TABLE x;--"), "COUPON_REJECTED");
    await applyCoupon(owner, " tenoff ");
    const cart = await getCart(owner);
    expect(cart.couponCode).toBe("TENOFF");
    expect(cart.totals.discountCents).toBe(500);
  });

  it("merges a guest cart into the user's cart on sign-in", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 5000, stock: 4 }] });
    const user = await makeUser();
    const token = crypto.randomUUID();
    await addToCart({ userId: user.id }, p.variants[0]!.id, 3);
    await addToCart({ guestToken: token }, p.variants[0]!.id, 3);
    await mergeGuestCart(token, user.id);
    const cart = await getCart({ userId: user.id });
    expect(cart.lines[0]!.quantity).toBe(4); // capped at stock
    expect(await db.cart.findUnique({ where: { guestToken: token } })).toBeNull();
  });
});

describe("orders", () => {
  let categoryId: string;
  beforeEach(async () => {
    await resetDatabase();
    categoryId = (await makeCategory("audio")).id;
  });

  it("creates an order with server-side totals, snapshots and reserved stock", async () => {
    const p = await makeProduct({
      categoryId,
      variants: [{ priceCents: 34900, stock: 5, name: "Graphite" }],
    });
    const owner = guest();
    await addToCart(owner, p.variants[0]!.id, 2);

    // Extra fields a tampered client might send are ignored by validation.
    const order = await createOrderFromCart(
      owner,
      { ...validCheckout(), totalCents: 1, discountCents: 99999, items: [{ unitPriceCents: 1 }] },
      null,
    );
    expect(order.totalCents).toBe(69800);

    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    expect(saved).toMatchObject({
      status: "PENDING_PAYMENT",
      subtotalCents: 69800,
      shippingCents: 0,
      totalCents: 69800,
    });
    expect(saved.items[0]).toMatchObject({
      unitPriceCents: 34900,
      quantity: 2,
      variantName: "Graphite",
      productName: p.name,
    });
    expect(saved.reservedUntil).not.toBeNull();
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(3);

    // Changing the product later doesn't rewrite history.
    await db.productVariant.update({ where: { id: p.variants[0]!.id }, data: { priceCents: 1 } });
    await db.product.update({ where: { id: p.id }, data: { name: "Renamed" } });
    const again = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(again).toMatchObject({ unitPriceCents: 34900, productName: p.name });
  });

  it("rejects invalid addresses with field errors", async () => {
    const p = await makeProduct({ categoryId });
    const owner = guest();
    await addToCart(owner, p.variants[0]!.id, 1);
    const bad = validCheckout({
      email: "not-an-email",
      address: { fullName: "", line1: "x", postalCode: "97100", city: "Pointe-à-Pitre", country: "US" },
    });
    await expect(createOrderFromCart(owner, bad, null)).rejects.toSatisfy((e: unknown) => {
      const err = e as AppError;
      const fields = err.details?.fieldErrors as Record<string, string>;
      return (
        err.code === "VALIDATION" &&
        "email" in fields &&
        "address.fullName" in fields &&
        "address.postalCode" in fields &&
        "address.country" in fields
      );
    });
    expect(await db.order.count()).toBe(0);
  });

  it("refuses an empty cart and a cart with problems", async () => {
    await expectAppError(createOrderFromCart(guest(), validCheckout(), null), "CART_EMPTY");
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 1000, stock: 2 }] });
    const owner = guest();
    await addToCart(owner, p.variants[0]!.id, 2);
    await db.productVariant.update({ where: { id: p.variants[0]!.id }, data: { stock: 1 } });
    await expectAppError(createOrderFromCart(owner, validCheckout(), null), "CART_CHANGED");
  });

  it("never oversells under concurrent checkouts", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 1000, stock: 3 }] });
    const owners = Array.from({ length: 8 }, () => guest());
    for (const o of owners) await addToCart(o, p.variants[0]!.id, 1);

    const results = await Promise.allSettled(
      owners.map((o) => createOrderFromCart(o, validCheckout(), null)),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(failed).toHaveLength(5);
    for (const f of failed) {
      expect(["OUT_OF_STOCK", "CART_CHANGED"]).toContain(
        ((f as PromiseRejectedResult).reason as AppError).code,
      );
    }
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(0);
  });

  it("enforces coupon usage limits under concurrency", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 10000, stock: 50 }] });
    await db.coupon.create({ data: { code: "ONCE", type: "FIXED", value: 1000, maxRedemptions: 1 } });
    const owners = Array.from({ length: 4 }, () => guest());
    for (const o of owners) {
      await addToCart(o, p.variants[0]!.id, 1);
      await applyCoupon(o, "ONCE");
    }
    const results = await Promise.allSettled(
      owners.map((o) => createOrderFromCart(o, validCheckout(), null)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "ONCE" } })).redemptionCount).toBe(1);
  });

  it("releases expired reservations and returns stock", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 1000, stock: 2 }] });
    const owner = guest();
    await addToCart(owner, p.variants[0]!.id, 2);
    const order = await createOrderFromCart(owner, validCheckout(), null);
    await db.order.update({ where: { id: order.id }, data: { reservedUntil: new Date(Date.now() - 1000) } });
    expect(await releaseExpiredReservations()).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(2);
  });

  it("only allows valid status transitions and audits them", async () => {
    expect(canTransition("PAID", "SHIPPED")).toBe(true);
    expect(canTransition("PAID", "CANCELLED")).toBe(false);
    expect(canTransition("DELIVERED", "PENDING_PAYMENT")).toBe(false);

    const admin = await makeUser("ADMIN");
    const p = await makeProduct({ categoryId });
    const owner = guest();
    await addToCart(owner, p.variants[0]!.id, 1);
    const order = await createOrderFromCart(owner, validCheckout(), null);
    await expectAppError(transitionOrder(order.id, "SHIPPED", admin.id), "INVALID_TRANSITION");
    await transitionOrder(order.id, "CANCELLED", admin.id);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(10);
    expect(await db.auditLog.count({ where: { entityId: order.id } })).toBe(1);
  });

  it("database constraints reject impossible states even if code is wrong", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 1000, stock: 1 }] });
    await expect(
      db.productVariant.update({ where: { id: p.variants[0]!.id }, data: { stock: -1 } }),
    ).rejects.toThrow();
    const user = await makeUser();
    await expect(
      db.review.create({ data: { productId: p.id, userId: user.id, rating: 6, title: "x", body: "y" } }),
    ).rejects.toThrow();
  });
});
