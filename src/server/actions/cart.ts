"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  addToCart,
  applyCoupon,
  getCartItemCount,
  removeCoupon,
  removeLine,
  setLineQuantity,
} from "@/server/cart";
import { ensureCartOwner, getCartOwner } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { AppError, toActionError, type ActionResult } from "@/server/errors";

const id = z.string().min(1).max(64);
const quantity = z.coerce.number().int();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new AppError("VALIDATION", "Invalid request.");
  return r.data;
}

export async function addToCartAction(
  variantId: string,
  qty: number,
): Promise<ActionResult<{ quantityInCart: number; cartCount: number }>> {
  try {
    await enforceRateLimit("cart", 40, 60_000);
    const owner = await ensureCartOwner();
    const quantityInCart = await addToCart(owner, parse(id, variantId), parse(quantity, qty));
    refresh();
    return { ok: true, data: { quantityInCart, cartCount: await getCartItemCount(owner) } };
  } catch (e) {
    return toActionError(e);
  }
}

async function ownerOrThrow() {
  const owner = await getCartOwner();
  if (!owner) throw new AppError("NOT_FOUND", "Your cart is empty.");
  return owner;
}

export async function setQuantityAction(itemId: string, qty: number): Promise<ActionResult> {
  try {
    await enforceRateLimit("cart", 40, 60_000);
    await setLineQuantity(await ownerOrThrow(), parse(id, itemId), parse(quantity, qty));
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeLineAction(itemId: string): Promise<ActionResult> {
  try {
    await removeLine(await ownerOrThrow(), parse(id, itemId));
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export type CouponState = ActionResult | null;

export async function applyCouponAction(_prev: CouponState, form: FormData): Promise<CouponState> {
  try {
    // Tight limit: coupon codes are guessable secrets.
    await enforceRateLimit("coupon", 10, 60_000);
    const code = parse(z.string().max(64), form.get("code") ?? "");
    await applyCoupon(await ownerOrThrow(), code);
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeCouponAction(): Promise<ActionResult> {
  try {
    await removeCoupon(await ownerOrThrow());
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
