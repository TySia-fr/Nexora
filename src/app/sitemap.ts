import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/server/db";

/** Public, indexable pages only. Built from the database at request time. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        slug: true,
        updatedAt: true,
        // Product-level images only (variant shots are duplicates for search).
        images: { where: { variantId: null }, orderBy: { position: "asc" }, select: { url: true } },
      },
    }),
    db.category.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["", "/products", "/about", "/contact", "/shipping", "/returns", "/privacy", "/terms"];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}` })),
    ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: c.updatedAt })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
      images: p.images.map((i) => `${base}${i.url}`),
    })),
  ];
}
