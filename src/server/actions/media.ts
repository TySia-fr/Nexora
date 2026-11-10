"use server";

import { refresh, revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { deleteImage, moveImage, updateImageAlt } from "@/server/media";
import { CATALOG_TAG } from "@/server/catalog";
import { AppError, toActionError, type ActionResult } from "@/server/errors";

const id = z.string().min(1).max(64);

function parseId(value: unknown): string {
  const r = id.safeParse(value);
  if (!r.success) throw new AppError("VALIDATION", "Invalid request.");
  return r.data;
}

function imagesChanged() {
  updateTag(CATALOG_TAG);
  revalidatePath("/products/[slug]", "page");
  refresh();
}

export async function updateImageAltAction(imageId: string, alt: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await updateImageAlt(admin.id, parseId(imageId), alt);
    imagesChanged();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moveImageAction(imageId: string, direction: number): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (direction !== -1 && direction !== 1) throw new AppError("VALIDATION", "Invalid request.");
    await moveImage(admin.id, parseId(imageId), direction);
    imagesChanged();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteImageAction(imageId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await deleteImage(admin.id, parseId(imageId));
    imagesChanged();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
