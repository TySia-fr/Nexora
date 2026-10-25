import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export async function toggleWishlist(userId: string, productId: string): Promise<boolean> {
  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!product) throw new AppError("NOT_FOUND", "This product is no longer available.");
  const existing = await db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    return false;
  }
  await db.wishlistItem.create({ data: { userId, productId } });
  return true;
}

export async function isInWishlist(userId: string, productId: string): Promise<boolean> {
  return Boolean(await db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } }));
}

export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}
