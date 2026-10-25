"use server";

import { z } from "zod";
import { getProductsByIds, searchSuggestions, type ProductCardView } from "@/server/catalog";
import { enforceRateLimit } from "@/server/rate-limit";

/** Cards for "recently viewed": ids come from the visitor's own localStorage. */
export async function recentlyViewedAction(ids: unknown): Promise<ProductCardView[]> {
  const parsed = z.array(z.string().min(1).max(64)).max(12).safeParse(ids);
  if (!parsed.success) return [];
  return getProductsByIds(parsed.data);
}

export async function suggestAction(q: unknown) {
  const parsed = z.string().max(80).safeParse(q);
  if (!parsed.success) return [];
  try {
    await enforceRateLimit("suggest", 120, 60_000);
  } catch {
    return [];
  }
  return searchSuggestions(parsed.data);
}
