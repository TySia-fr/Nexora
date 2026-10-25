"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/server/session";
import { toggleWishlist } from "@/server/wishlist";
import { AppError, toActionError, type ActionResult } from "@/server/errors";

export async function toggleWishlistAction(productId: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const viewer = await getViewer();
    if (!viewer) throw new AppError("UNAUTHENTICATED", "Sign in to save products.");
    const parsed = z.string().min(1).max(64).safeParse(productId);
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid request.");
    const saved = await toggleWishlist(viewer.id, parsed.data);
    refresh();
    return { ok: true, data: { saved } };
  } catch (e) {
    return toActionError(e);
  }
}
