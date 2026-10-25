import "server-only";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { getCart, loadCoupon, type CartOwner } from "@/server/cart";
import { computeTotals, COUPON_REJECTION_MESSAGES } from "@/lib/pricing";
import { checkoutSchema, fieldErrors, type CheckoutInput } from "@/lib/validation/checkout";
import type { OrderStatus } from "@/generated/prisma/client";

/** How long unpaid orders hold stock. Matches the Stripe session lifetime. */
export const RESERVATION_MINUTES = 30;

export function formatOrderNumber(n: number): string {
  return `NX-${n}`;
}

// ---------------------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------------------

/**
 * Allowed transitions. PAID orders are never "cancelled": money has moved, so
 * the only way out is a refund (issued in Stripe, then recorded here).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/**
 * Atomically takes `quantity` units. Returns false when not enough stock is
 * left; the row is only touched when the condition holds (see ADR-0003).
 */
async function takeStock(tx: Tx, variantId: string, quantity: number): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE "ProductVariant"
    SET "stock" = "stock" - ${quantity}, "updatedAt" = now()
    WHERE "id" = ${variantId} AND "isActive" AND "stock" >= ${quantity}
  `;
  return updated === 1;
}

async function returnStock(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });
  for (const item of items) {
    // A variant deleted since the order leaves nothing to restock.
    if (!item.variantId) continue;
    await tx.$executeRaw`
      UPDATE "ProductVariant" SET "stock" = "stock" + ${item.quantity}, "updatedAt" = now()
      WHERE "id" = ${item.variantId}
    `;
  }
}

async function releaseCouponRedemption(tx: Tx, couponId: string | null) {
  if (!couponId) return;
  await tx.$executeRaw`
    UPDATE "Coupon" SET "redemptionCount" = "redemptionCount" - 1
    WHERE "id" = ${couponId} AND "redemptionCount" > 0
  `;
}

// ---------------------------------------------------------------------------
// Creating orders
// ---------------------------------------------------------------------------

export type CreatedOrder = {
  id: string;
  number: number;
  totalCents: number;
  email: string;
  cartId: string;
  items: { productName: string; variantName: string; unitPriceCents: number; quantity: number }[];
  shippingCents: number;
  discountCents: number;
  couponCode: string | null;
};

/**
 * Turns the caller's cart into a PENDING_PAYMENT order inside one transaction:
 * re-reads prices, re-validates the coupon, reserves stock and snapshots
 * everything onto the order. Nothing from the browser except the address,
 * email and delivery choice is trusted.
 */
export async function createOrderFromCart(
  owner: CartOwner,
  rawInput: unknown,
  userId: string | null,
): Promise<CreatedOrder> {
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please check the highlighted fields.", {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  const input: CheckoutInput = parsed.data;

  // Free up stock held by abandoned checkouts before competing for it.
  await releaseExpiredReservations();

  return db.$transaction(
    async (tx) => {
      const cart = await getCart(owner, input.shippingMethod, tx);
      if (!cart.id || cart.lines.length === 0) throw new AppError("CART_EMPTY", "Your cart is empty.");
      const blocked = cart.lines.filter((l) => l.issue !== null);
      if (blocked.length > 0) {
        throw new AppError(
          "CART_CHANGED",
          "Some items in your cart changed. Review your cart before paying.",
          { lines: blocked.map((l) => ({ id: l.id, issue: l.issue })) },
        );
      }

      const coupon = cart.couponCode ? await loadCoupon(cart.couponCode, tx) : null;
      const totals = computeTotals({
        lines: cart.lines.map((l) => ({
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
          categoryId: l.categoryId,
        })),
        coupon,
        shippingMethod: input.shippingMethod,
        now: new Date(),
      });
      if (cart.couponCode && (!coupon || totals.couponRejection)) {
        throw new AppError(
          "COUPON_REJECTED",
          totals.couponRejection
            ? `${COUPON_REJECTION_MESSAGES[totals.couponRejection]} Remove it to continue.`
            : "Your discount code is no longer valid. Remove it to continue.",
        );
      }

      for (const line of cart.lines) {
        if (!(await takeStock(tx, line.variantId, line.quantity))) {
          throw new AppError("OUT_OF_STOCK", `${line.productName} (${line.variantName}) just sold out.`, {
            lineId: line.id,
          });
        }
      }

      if (coupon && totals.appliedCoupon) {
        const claimed = await tx.$executeRaw`
          UPDATE "Coupon" SET "redemptionCount" = "redemptionCount" + 1, "updatedAt" = now()
          WHERE "id" = ${coupon.id}
            AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")
        `;
        if (claimed !== 1) {
          throw new AppError(
            "COUPON_REJECTED",
            `${COUPON_REJECTION_MESSAGES.exhausted} Remove it to continue.`,
          );
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          email: input.email,
          status: "PENDING_PAYMENT",
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          couponId: totals.appliedCoupon ? (coupon?.id ?? null) : null,
          couponCode: totals.appliedCoupon,
          shippingMethod: input.shippingMethod,
          shipFullName: input.address.fullName,
          shipLine1: input.address.line1,
          shipLine2: input.address.line2 ?? null,
          shipPostalCode: input.address.postalCode,
          shipCity: input.address.city,
          shipCountry: input.address.country,
          shipPhone: input.address.phone ?? null,
          reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60_000),
          items: {
            create: cart.lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              productSlug: l.productSlug,
              productName: l.productName,
              variantName: l.variantName,
              sku: l.sku,
              unitPriceCents: l.unitPriceCents,
              quantity: l.quantity,
              lineTotalCents: l.lineTotalCents,
            })),
          },
        },
        include: { items: true },
      });

      return {
        id: order.id,
        number: order.number,
        totalCents: order.totalCents,
        email: order.email,
        cartId: cart.id,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents,
        couponCode: order.couponCode,
        items: order.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
      };
    },
    { isolationLevel: "ReadCommitted", timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// Payment outcomes (called from the verified webhook handler only)
// ---------------------------------------------------------------------------

/**
 * PENDING_PAYMENT → PAID. Returns false if the order was not pending (already
 * paid, or cancelled because the reservation expired), so callers can log it.
 */
export async function markOrderPaid(
  tx: Tx,
  orderId: string,
  payment: { sessionId: string; intentId: string | null; amountCents: number; currency: string },
  cartId: string | null,
): Promise<boolean> {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return false;
  if (payment.amountCents !== order.totalCents || payment.currency.toUpperCase() !== order.currency) {
    console.error("[nexora] payment amount mismatch", {
      orderId,
      expected: order.totalCents,
      got: payment.amountCents,
    });
    await tx.payment.updateMany({
      where: { providerSessionId: payment.sessionId },
      data: { status: "FAILED" },
    });
    return false;
  }

  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "PAID", paidAt: new Date(), reservedUntil: null },
  });
  if (count === 0) return false;

  await tx.payment.upsert({
    where: { providerSessionId: payment.sessionId },
    create: {
      orderId,
      providerSessionId: payment.sessionId,
      providerIntentId: payment.intentId,
      status: "SUCCEEDED",
      amountCents: payment.amountCents,
    },
    update: { status: "SUCCEEDED", providerIntentId: payment.intentId },
  });

  for (const item of order.items) {
    await tx.product
      .update({
        where: { id: item.productId },
        data: { unitsSold: { increment: item.quantity } },
      })
      .catch(() => undefined); // product deleted since: nothing to count
  }

  // Remove what was bought from the cart that started this checkout.
  if (cartId) {
    const variantIds = order.items.flatMap((i) => (i.variantId ? [i.variantId] : []));
    await tx.cartItem.deleteMany({ where: { cartId, variantId: { in: variantIds } } });
    if (order.couponCode) {
      await tx.cart.updateMany({
        where: { id: cartId, couponCode: order.couponCode },
        data: { couponCode: null },
      });
    }
  }
  return true;
}

/** PENDING_PAYMENT → CANCELLED, returning stock and the coupon use. */
export async function cancelPendingOrder(
  tx: Tx,
  orderId: string,
  paymentStatus: "FAILED" | "EXPIRED" | null,
): Promise<boolean> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true } });
  if (!order) return false;
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED", reservedUntil: null },
  });
  if (count === 0) return false;
  await returnStock(tx, orderId);
  await releaseCouponRedemption(tx, order.couponId);
  if (paymentStatus) {
    await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: paymentStatus } });
  }
  return true;
}

/**
 * Safety net for reservations whose Stripe expiry webhook never arrived.
 * Cheap (indexed on status, reservedUntil); run before creating new orders.
 */
export async function releaseExpiredReservations(now = new Date()): Promise<number> {
  const expired = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", reservedUntil: { lt: now } },
    select: { id: true },
    take: 50,
  });
  let released = 0;
  for (const { id } of expired) {
    const done = await db.$transaction((tx) => cancelPendingOrder(tx, id, "EXPIRED"));
    if (done) released++;
  }
  return released;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getOrderForUser(userId: string, orderId: string) {
  // Filtering by userId in the query (not after) is the IDOR guard.
  return db.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true, payments: { select: { status: true, createdAt: true } } },
  });
}

export async function listOrdersForUser(userId: string, page = 1, pageSize = 10) {
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
    db.order.count({ where: { userId } }),
  ]);
  return { orders, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Used by the checkout success page: looks up by the (unguessable) Stripe session id. */
export async function getOrderByCheckoutSession(sessionId: string) {
  const payment = await db.payment.findUnique({
    where: { providerSessionId: sessionId },
    select: {
      order: {
        select: { id: true, number: true, status: true, email: true, totalCents: true, currency: true },
      },
    },
  });
  return payment?.order ?? null;
}

// ---------------------------------------------------------------------------
// Admin transitions
// ---------------------------------------------------------------------------

export async function transitionOrder(orderId: string, to: OrderStatus, actorId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) throw new AppError("NOT_FOUND", "Order not found.");
    if (!canTransition(order.status, to)) {
      throw new AppError(
        "INVALID_TRANSITION",
        `An order that is ${order.status.toLowerCase()} cannot become ${to.toLowerCase()}.`,
      );
    }
    if (to === "CANCELLED") {
      // Only PENDING_PAYMENT can reach CANCELLED (see ORDER_TRANSITIONS).
      await cancelPendingOrder(tx, orderId, null);
    } else {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: to },
      });
      if (count === 0)
        throw new AppError("CONFLICT", "The order changed in the meantime. Reload and try again.");
      if (to === "REFUNDED") {
        await tx.payment.updateMany({
          where: { orderId, status: "SUCCEEDED" },
          data: { status: "REFUNDED" },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "order.transition",
        entity: "Order",
        entityId: orderId,
        data: { from: order.status, to },
      },
    });
  });
}
