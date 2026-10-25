"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import {
  adjustStock,
  createCoupon,
  deleteCategory,
  deleteProduct,
  moderateReview,
  saveCategory,
  saveProduct,
  setCouponActive,
} from "@/server/admin";
import { transitionOrder } from "@/server/orders";
import { CATALOG_TAG } from "@/server/catalog";
import { AppError, toActionError, type ActionResult } from "@/server/errors";

/**
 * Every admin mutation starts with requireAdmin(): role is re-read from the
 * database on each call, so hiding links is never the protection.
 */

export type AdminFormState = (ActionResult & { values?: Record<string, string> }) | null;
const id = z.string().min(1).max(64);

function parseId(value: unknown): string {
  const r = id.safeParse(value);
  if (!r.success) throw new AppError("VALIDATION", "Invalid request.");
  return r.data;
}

const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export async function transitionOrderAction(orderId: string, to: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const status = z.enum(ORDER_STATUSES).safeParse(to);
    if (!status.success) throw new AppError("VALIDATION", "Unknown status.");
    await transitionOrder(parseId(orderId), status.data, admin.id);
    updateTag(CATALOG_TAG); // cancellations return stock
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

function productFromForm(form: FormData) {
  const variantIds = form.getAll("variant.id").map(String);
  return {
    name: form.get("name"),
    slug: form.get("slug"),
    tagline: form.get("tagline"),
    description: form.get("description"),
    categoryId: form.get("categoryId"),
    status: form.get("status"),
    featured: form.get("featured") === "on",
    specs: String(form.get("specs") ?? ""),
    features: String(form.get("features") ?? ""),
    variants: variantIds.map((vid, i) => ({
      id: vid || undefined,
      sku: String(form.getAll("variant.sku")[i] ?? ""),
      name: String(form.getAll("variant.name")[i] ?? ""),
      colorHex: String(form.getAll("variant.colorHex")[i] ?? ""),
      price: String(form.getAll("variant.price")[i] ?? ""),
      stock: String(form.getAll("variant.stock")[i] ?? ""),
      isActive: form.getAll("variant.active").map(String).includes(String(i)),
    })),
  };
}

export async function saveProductAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  let savedId: string;
  try {
    const admin = await requireAdmin();
    const existing = form.get("productId");
    savedId = await saveProduct(admin.id, existing ? parseId(existing) : null, productFromForm(form));
    updateTag(CATALOG_TAG);
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/admin/products/${savedId}?saved=1`);
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await deleteProduct(admin.id, parseId(productId));
    updateTag(CATALOG_TAG);
  } catch (e) {
    return toActionError(e);
  }
  redirect("/admin/products?deleted=1");
}

export async function adjustStockAction(
  variantId: string,
  delta: number,
): Promise<ActionResult<{ stock: number }>> {
  try {
    const admin = await requireAdmin();
    const stock = await adjustStock(admin.id, parseId(variantId), Number(delta));
    updateTag(CATALOG_TAG);
    refresh();
    return { ok: true, data: { stock } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveCategoryAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  try {
    const admin = await requireAdmin();
    const existing = form.get("categoryId");
    await saveCategory(admin.id, existing ? parseId(existing) : null, {
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description"),
      position: form.get("position"),
    });
    updateTag(CATALOG_TAG);
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await deleteCategory(admin.id, parseId(categoryId));
    updateTag(CATALOG_TAG);
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createCouponAction(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const str = (k: string) => (form.get(k) ? String(form.get(k)) : undefined);
  const values = Object.fromEntries(
    ["code", "type", "value", "minSubtotal", "categoryId", "startsAt", "endsAt", "maxRedemptions"].map(
      (k) => [k, str(k) ?? ""],
    ),
  );
  try {
    const admin = await requireAdmin();
    await createCoupon(admin.id, {
      code: str("code") ?? "",
      type: str("type"),
      value: str("value") ?? "",
      minSubtotal: str("minSubtotal"),
      categoryId: str("categoryId"),
      startsAt: str("startsAt"),
      endsAt: str("endsAt"),
      maxRedemptions: str("maxRedemptions"),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ...toActionError(e), values };
  }
}

export async function setCouponActiveAction(couponId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await setCouponActive(admin.id, parseId(couponId), Boolean(active));
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moderateReviewAction(reviewId: string, decision: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const status = z.enum(["APPROVED", "REJECTED"]).safeParse(decision);
    if (!status.success) throw new AppError("VALIDATION", "Invalid decision.");
    await moderateReview(admin.id, parseId(reviewId), status.data);
    updateTag(CATALOG_TAG);
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
