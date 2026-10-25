import "server-only";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  COUPON_REJECTION_MESSAGES,
  computeTotals,
  evaluateCoupon,
  type CouponRule,
  type ShippingMethodCode,
  type Totals,
} from "@/lib/pricing";

/** Who a cart belongs to. Resolved from the session or the guest cookie by the caller. */
export type CartOwner = { userId: string } | { guestToken: string };

export const MAX_LINE_QUANTITY = 10;

function ownerWhere(owner: CartOwner) {
  return "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken };
}

export async function findCartId(owner: CartOwner, tx: Tx | typeof db = db): Promise<string | null> {
  const cart = await tx.cart.findUnique({ where: ownerWhere(owner), select: { id: true } });
  return cart?.id ?? null;
}

async function getOrCreateCartId(owner: CartOwner, tx: Tx): Promise<string> {
  const where = ownerWhere(owner);
  const cart = await tx.cart.upsert({ where, create: where, update: {}, select: { id: true } });
  return cart.id;
}

const lineInclude = {
  variant: {
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          categoryId: true,
          images: {
            where: { variantId: null },
            orderBy: { position: "asc" as const },
            take: 1,
            select: { url: true, alt: true, width: true, height: true },
          },
        },
      },
      images: {
        orderBy: { position: "asc" as const },
        take: 1,
        select: { url: true, alt: true, width: true, height: true },
      },
    },
  },
};

export type CartLineIssue = "unavailable" | "out_of_stock" | "insufficient_stock";

export type CartLineView = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  categoryId: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  available: number;
  maxQuantity: number;
  image: { url: string; alt: string; width: number; height: number } | null;
  issue: CartLineIssue | null;
};

export type CartView = {
  id: string | null;
  lines: CartLineView[];
  itemCount: number;
  couponCode: string | null;
  couponMessage: string | null;
  totals: Totals;
  /** True when any line needs the customer's attention before checkout. */
  hasIssues: boolean;
};

const EMPTY_TOTALS: Totals = computeTotals({
  lines: [],
  coupon: null,
  shippingMethod: "STANDARD",
  now: new Date(0),
});

export async function loadCoupon(
  code: string,
  tx: Tx | typeof db = db,
): Promise<(CouponRule & { id: string }) | null> {
  const c = await tx.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  return c
    ? {
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        minSubtotalCents: c.minSubtotalCents,
        categoryId: c.categoryId,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        maxRedemptions: c.maxRedemptions,
        redemptionCount: c.redemptionCount,
        isActive: c.isActive,
      }
    : null;
}

/**
 * Builds the cart from current database prices and stock. Lines that can't be
 * bought are kept (so the customer sees what happened) but excluded from totals.
 */
export async function getCart(
  owner: CartOwner,
  shippingMethod: ShippingMethodCode = "STANDARD",
  tx: Tx | typeof db = db,
): Promise<CartView> {
  const cart = await tx.cart.findUnique({
    where: ownerWhere(owner),
    include: { items: { orderBy: { createdAt: "asc" }, include: lineInclude } },
  });
  if (!cart) {
    return {
      id: null,
      lines: [],
      itemCount: 0,
      couponCode: null,
      couponMessage: null,
      totals: EMPTY_TOTALS,
      hasIssues: false,
    };
  }

  const lines: CartLineView[] = cart.items.map((item) => {
    const v = item.variant;
    const p = v.product;
    const sellable = v.isActive && p.status === "ACTIVE";
    let issue: CartLineIssue | null = null;
    if (!sellable) issue = "unavailable";
    else if (v.stock === 0) issue = "out_of_stock";
    else if (item.quantity > v.stock) issue = "insufficient_stock";
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      productSlug: p.slug,
      productName: p.name,
      variantName: v.name,
      sku: v.sku,
      categoryId: p.categoryId,
      unitPriceCents: v.priceCents,
      quantity: item.quantity,
      lineTotalCents: v.priceCents * item.quantity,
      available: sellable ? v.stock : 0,
      maxQuantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, v.stock)),
      image: v.images[0] ?? p.images[0] ?? null,
      issue,
    };
  });

  const purchasable = lines.filter((l) => l.issue === null);
  const coupon = cart.couponCode ? await loadCoupon(cart.couponCode, tx) : null;
  const totals = computeTotals({
    lines: purchasable.map((l) => ({
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
      categoryId: l.categoryId,
    })),
    coupon,
    shippingMethod,
    now: new Date(),
  });

  let couponMessage: string | null = null;
  if (cart.couponCode && !coupon) couponMessage = COUPON_REJECTION_MESSAGES.inactive;
  else if (totals.couponRejection) couponMessage = COUPON_REJECTION_MESSAGES[totals.couponRejection];

  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    couponCode: cart.couponCode,
    couponMessage,
    totals,
    hasIssues: lines.some((l) => l.issue !== null),
  };
}

export async function getCartItemCount(owner: CartOwner): Promise<number> {
  const result = await db.cartItem.aggregate({
    where: { cart: ownerWhere(owner) },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    throw new AppError("VALIDATION", `Quantity must be between 1 and ${MAX_LINE_QUANTITY}.`);
  }
}

/**
 * Adds a variant. If the cart already holds it, quantities are combined and
 * capped at what is in stock (and the per-line limit).
 * Returns the quantity now in the cart for that variant.
 */
export async function addToCart(owner: CartOwner, variantId: string, quantity: number): Promise<number> {
  assertQuantity(quantity);
  return db.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, stock: true, isActive: true, product: { select: { status: true } } },
    });
    if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
      throw new AppError("UNAVAILABLE", "This product is no longer available.");
    }
    if (variant.stock === 0) throw new AppError("OUT_OF_STOCK", "This option is out of stock.");

    const cartId = await getOrCreateCartId(owner, tx);
    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
      select: { quantity: true },
    });
    const limit = Math.min(variant.stock, MAX_LINE_QUANTITY);
    const desired = (existing?.quantity ?? 0) + quantity;
    if ((existing?.quantity ?? 0) >= limit) {
      throw new AppError("OUT_OF_STOCK", `You already have the maximum available (${limit}) in your cart.`);
    }
    const next = Math.min(desired, limit);
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity: next },
      update: { quantity: next },
    });
    return next;
  });
}

/** Changes a line's quantity. The item must belong to the caller's cart. */
export async function setLineQuantity(owner: CartOwner, itemId: string, quantity: number): Promise<void> {
  assertQuantity(quantity);
  await db.$transaction(async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cart: ownerWhere(owner) },
      select: { id: true, variant: { select: { stock: true } } },
    });
    // Same response for "not yours" and "doesn't exist": no information leak.
    if (!item) throw new AppError("NOT_FOUND", "That item is no longer in your cart.");
    if (quantity > item.variant.stock) {
      throw new AppError("OUT_OF_STOCK", `Only ${item.variant.stock} left in stock.`, {
        available: item.variant.stock,
      });
    }
    await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
  });
}

export async function removeLine(owner: CartOwner, itemId: string): Promise<void> {
  const { count } = await db.cartItem.deleteMany({ where: { id: itemId, cart: ownerWhere(owner) } });
  if (count === 0) throw new AppError("NOT_FOUND", "That item is no longer in your cart.");
}

/** Validates a code against the current cart before storing it. */
export async function applyCoupon(owner: CartOwner, rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw new AppError("COUPON_REJECTED", COUPON_REJECTION_MESSAGES.inactive);
  }
  const cart = await getCart(owner);
  if (!cart.id || cart.lines.length === 0) throw new AppError("CART_EMPTY", "Your cart is empty.");
  const coupon = await loadCoupon(code);
  if (!coupon) throw new AppError("COUPON_REJECTED", COUPON_REJECTION_MESSAGES.inactive);
  const result = evaluateCoupon(
    coupon,
    cart.lines
      .filter((l) => l.issue === null)
      .map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity, categoryId: l.categoryId })),
    new Date(),
  );
  if ("rejection" in result) {
    throw new AppError("COUPON_REJECTED", COUPON_REJECTION_MESSAGES[result.rejection]);
  }
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
}

export async function removeCoupon(owner: CartOwner): Promise<void> {
  await db.cart.updateMany({ where: ownerWhere(owner), data: { couponCode: null } });
}

/**
 * On sign-in, folds the guest cart into the user's cart (quantities combined,
 * capped by stock) and deletes the guest cart.
 */
export async function mergeGuestCart(guestToken: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { guestToken },
      include: { items: { include: { variant: { select: { stock: true } } } } },
    });
    if (!guest) return;
    const userCartId = await getOrCreateCartId({ userId }, tx);
    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCartId, variantId: item.variantId } },
      });
      const limit = Math.min(item.variant.stock, MAX_LINE_QUANTITY);
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, limit);
      if (quantity < 1) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCartId, variantId: item.variantId } },
        create: { cartId: userCartId, variantId: item.variantId, quantity },
        update: { quantity },
      });
    }
    if (guest.couponCode) {
      await tx.cart.update({ where: { id: userCartId }, data: { couponCode: guest.couponCode } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
