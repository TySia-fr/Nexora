"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { CATALOG_TAG } from "@/server/catalog";
import { adjustStock, updateVariantSettings } from "@/server/inventory";
import { cancelCount, commitCount, openCount, recordCounts, refreshStaleLines } from "@/server/stock-counts";
import { AppError, toActionError, type ActionResult } from "@/server/errors";

/**
 * Inventory mutations. Each one re-checks the admin role (requireAdmin reads it from
 * the database), validates with zod in the domain layer and writes an audit entry.
 */

export type InventoryFormState = (ActionResult & { values?: Record<string, string> }) | null;

const id = z.string().min(1).max(64);
function parseId(value: unknown): string {
  const r = id.safeParse(value);
  if (!r.success) throw new AppError("VALIDATION", "Invalid request.");
  return r.data;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Stock changes are visible to shoppers, so the catalogue cache is expired too. */
function stockChanged() {
  updateTag(CATALOG_TAG);
  refresh();
}

export async function adjustStockAction(
  _prev: InventoryFormState,
  form: FormData,
): Promise<InventoryFormState> {
  const values = { reason: str(form, "reason"), quantity: str(form, "quantity"), note: str(form, "note") };
  try {
    const admin = await requireAdmin();
    await adjustStock(admin.id, { variantId: str(form, "variantId"), ...values });
    stockChanged();
    return { ok: true };
  } catch (e) {
    return { ...toActionError(e), values };
  }
}

export async function updateVariantSettingsAction(
  _prev: InventoryFormState,
  form: FormData,
): Promise<InventoryFormState> {
  const values = { reorderPoint: str(form, "reorderPoint"), costCents: str(form, "cost") };
  try {
    const admin = await requireAdmin();
    await updateVariantSettings(admin.id, {
      variantId: str(form, "variantId"),
      reorderPoint: values.reorderPoint,
      costCents: values.costCents,
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return { ...toActionError(e), values };
  }
}

export async function openCountAction(
  _prev: InventoryFormState,
  form: FormData,
): Promise<InventoryFormState> {
  let countId: string;
  try {
    const admin = await requireAdmin();
    countId = await openCount(admin.id, { categoryId: str(form, "categoryId"), note: str(form, "note") });
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/admin/inventory/counts/${countId}`);
}

export async function recordCountsAction(
  _prev: InventoryFormState,
  form: FormData,
): Promise<InventoryFormState> {
  try {
    const admin = await requireAdmin();
    const entries = [...form.entries()]
      .filter(([k]) => k.startsWith("counted:"))
      .map(([k, v]) => ({ lineId: k.slice("counted:".length), counted: String(v).trim() }));
    await recordCounts(admin.id, { countId: str(form, "countId"), entries });
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function commitCountAction(
  countId: string,
): Promise<ActionResult<{ corrected: number; skipped: number }>> {
  try {
    const admin = await requireAdmin();
    const data = await commitCount(admin.id, parseId(countId));
    stockChanged();
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelCountAction(countId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await cancelCount(admin.id, parseId(countId));
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function refreshStaleLinesAction(countId: string): Promise<ActionResult<{ lines: number }>> {
  try {
    const admin = await requireAdmin();
    const lines = await refreshStaleLines(admin.id, parseId(countId));
    refresh();
    return { ok: true, data: { lines } };
  } catch (e) {
    return toActionError(e);
  }
}
