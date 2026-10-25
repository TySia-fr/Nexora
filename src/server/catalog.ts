import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { PAGE_SIZE, type ListingQuery } from "@/lib/validation/catalog";

/**
 * Catalog reads. Everything here is public data, so results are cached and
 * tagged; admin mutations call `updateTag(CATALOG_TAG)` (see ADR-0006).
 */
export const CATALOG_TAG = "catalog";

export type ProductImageView = { url: string; alt: string; width: number; height: number };

export type ProductCardView = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categoryName: string;
  categorySlug: string;
  priceFromCents: number;
  hasPriceRange: boolean;
  inStock: boolean;
  colors: { name: string; hex: string }[];
  image: ProductImageView | null;
  hoverImage: ProductImageView | null;
};

const cardInclude = {
  category: { select: { name: true, slug: true } },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: { name: true, colorHex: true, priceCents: true, stock: true },
  },
  images: {
    where: { variantId: null },
    orderBy: { position: "asc" },
    take: 2,
    select: { url: true, alt: true, width: true, height: true },
  },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function toCard(p: CardRow): ProductCardView {
  const prices = p.variants.map((v) => v.priceCents);
  const priceFromCents = prices.length ? Math.min(...prices) : 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    categoryName: p.category.name,
    categorySlug: p.category.slug,
    priceFromCents,
    hasPriceRange: prices.some((c) => c !== priceFromCents),
    inStock: p.variants.some((v) => v.stock > 0),
    colors: p.variants
      .filter((v): v is typeof v & { colorHex: string } => Boolean(v.colorHex))
      .map((v) => ({ name: v.name, hex: v.colorHex })),
    image: p.images[0] ?? null,
    hoverImage: p.images[1] ?? null,
  };
}

/** Escapes LIKE wildcards so user input is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export type ListingResult = {
  products: ProductCardView[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Filtered, sorted, paginated listing. Filtering happens in SQL (parameterised
 * with Prisma.sql); the matching page of ids is then hydrated with Prisma.
 * For the catalog size we target (hundreds of products) ILIKE is sufficient;
 * past that, move `q` to Postgres full-text search with a GIN index.
 */
export async function listProducts(query: ListingQuery): Promise<ListingResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const where: Prisma.Sql[] = [Prisma.sql`p."status" = 'ACTIVE'`];
  if (query.category) where.push(Prisma.sql`c."slug" = ${query.category}`);
  if (query.q) {
    const pattern = likePattern(query.q);
    where.push(
      Prisma.sql`(p."name" ILIKE ${pattern} OR p."tagline" ILIKE ${pattern} OR c."name" ILIKE ${pattern})`,
    );
  }
  if (query.min !== undefined) where.push(Prisma.sql`v.price_from >= ${query.min * 100}`);
  if (query.max !== undefined) where.push(Prisma.sql`v.price_from <= ${query.max * 100}`);
  if (query.inStock) where.push(Prisma.sql`v.in_stock`);

  const orderBy = {
    newest: Prisma.sql`p."createdAt" DESC, p."id"`,
    price_asc: Prisma.sql`v.price_from ASC, p."id"`,
    price_desc: Prisma.sql`v.price_from DESC, p."id"`,
    popular: Prisma.sql`p."unitsSold" DESC, p."createdAt" DESC, p."id"`,
  }[query.sort];

  const offset = (query.page - 1) * PAGE_SIZE;

  const rows = await db.$queryRaw<{ id: string; total: bigint }[]>`
    WITH v AS (
      SELECT "productId", MIN("priceCents") AS price_from, BOOL_OR("stock" > 0) AS in_stock
      FROM "ProductVariant"
      WHERE "isActive"
      GROUP BY "productId"
    )
    SELECT p."id", COUNT(*) OVER () AS total
    FROM "Product" p
    JOIN v ON v."productId" = p."id"
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY ${orderBy}
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const total = rows.length ? Number(rows[0]!.total) : await countMatching(where);
  const ids = rows.map((r) => r.id);
  const found = await db.product.findMany({ where: { id: { in: ids } }, include: cardInclude });
  const byId = new Map(found.map((p) => [p.id, p]));
  const products = ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [toCard(p)] : [];
  });

  return {
    products,
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Only used when the requested page is past the end (so no rows carry a total). */
async function countMatching(where: Prisma.Sql[]): Promise<number> {
  const [row] = await db.$queryRaw<{ total: bigint }[]>`
    WITH v AS (
      SELECT "productId", MIN("priceCents") AS price_from, BOOL_OR("stock" > 0) AS in_stock
      FROM "ProductVariant" WHERE "isActive" GROUP BY "productId"
    )
    SELECT COUNT(*) AS total
    FROM "Product" p
    JOIN v ON v."productId" = p."id"
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE ${Prisma.join(where, " AND ")}
  `;
  return Number(row?.total ?? 0);
}

export async function getFeaturedProducts(limit = 4): Promise<ProductCardView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", featured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: cardInclude,
  });
  return rows.map(toCard);
}

export async function getNewArrivals(limit = 4): Promise<ProductCardView[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: cardInclude,
  });
  return rows.map(toCard);
}

export type CategoryView = {
  slug: string;
  name: string;
  description: string;
  productCount: number;
};

export async function getCategories(): Promise<CategoryView[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const rows = await db.category.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } },
  });
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    productCount: c._count.products,
  }));
}

export async function getCategory(slug: string): Promise<CategoryView | null> {
  const all = await getCategories();
  return all.find((c) => c.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

export type VariantView = {
  id: string;
  sku: string;
  name: string;
  colorHex: string | null;
  priceCents: number;
  stock: number;
  images: ProductImageView[];
};

export type ReviewView = {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

export type ProductDetailView = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: { slug: string; name: string };
  specs: { label: string; value: string }[];
  features: { title: string; body: string }[];
  images: ProductImageView[];
  variants: VariantView[];
  rating: { average: number; count: number } | null;
  reviews: ReviewView[];
  updatedAt: string;
};

function asPairs<T extends Record<string, string>>(value: unknown, keys: (keyof T)[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is T =>
      typeof item === "object" &&
      item !== null &&
      keys.every((k) => typeof (item as Record<string, unknown>)[k as string] === "string"),
  );
}

/** First name + last initial: reviews never expose full names or emails. */
function publicAuthor(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : (first ?? "Customer");
}

export async function getProductBySlug(slug: string): Promise<ProductDetailView | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const p = await db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      category: { select: { slug: true, name: true } },
      images: { orderBy: { position: "asc" } },
      variants: { where: { isActive: true }, orderBy: { position: "asc" } },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!p) return null;

  const agg = await db.review.aggregate({
    where: { productId: p.id, status: "APPROVED" },
    _avg: { rating: true },
    _count: true,
  });

  const toImage = (i: (typeof p.images)[number]): ProductImageView => ({
    url: i.url,
    alt: i.alt,
    width: i.width,
    height: i.height,
  });
  const generalImages = p.images.filter((i) => i.variantId === null).map(toImage);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    category: p.category,
    specs: asPairs<{ label: string; value: string }>(p.specs, ["label", "value"]),
    features: asPairs<{ title: string; body: string }>(p.features, ["title", "body"]),
    images: generalImages,
    variants: p.variants.map((v) => {
      const own = p.images.filter((i) => i.variantId === v.id).map(toImage);
      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        colorHex: v.colorHex,
        priceCents: v.priceCents,
        stock: v.stock,
        images: own.length ? own : generalImages,
      };
    }),
    rating:
      agg._count > 0 && agg._avg.rating !== null
        ? { average: Math.round(agg._avg.rating * 10) / 10, count: agg._count }
        : null,
    reviews: p.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: publicAuthor(r.user.name),
      verifiedPurchase: r.verifiedPurchase,
      createdAt: r.createdAt.toISOString(),
    })),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Same category first, then best sellers; never the product itself. */
export async function getRelatedProducts(productId: string, categorySlug: string, limit = 4) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const sameCategory = await db.product.findMany({
    where: { status: "ACTIVE", id: { not: productId }, category: { slug: categorySlug } },
    orderBy: { unitsSold: "desc" },
    take: limit,
    include: cardInclude,
  });
  if (sameCategory.length >= limit) return sameCategory.map(toCard);
  const others = await db.product.findMany({
    where: {
      status: "ACTIVE",
      id: { notIn: [productId, ...sameCategory.map((p) => p.id)] },
    },
    orderBy: { unitsSold: "desc" },
    take: limit - sameCategory.length,
    include: cardInclude,
  });
  return [...sameCategory, ...others].map(toCard);
}

export async function getProductsByIds(ids: string[]): Promise<ProductCardView[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids.slice(0, 12) }, status: "ACTIVE" },
    include: cardInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [toCard(r)] : [];
  });
}

/** Top suggestions for the search box (name prefix first, then substring). */
export async function searchSuggestions(q: string, limit = 6) {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const pattern = likePattern(term);
  const prefix = `${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.$queryRaw<{ slug: string; name: string; category: string }[]>`
    SELECT p."slug", p."name", c."name" AS category
    FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."status" = 'ACTIVE' AND (p."name" ILIKE ${pattern} OR c."name" ILIKE ${pattern})
    ORDER BY (p."name" ILIKE ${prefix}) DESC, p."unitsSold" DESC, p."name"
    LIMIT ${limit}
  `;
  return rows;
}
