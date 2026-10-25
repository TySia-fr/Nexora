/**
 * Deterministic demo data. Safe to re-run: it replaces catalog, coupons and
 * the fictional reviewers' data, and never touches real customer accounts.
 * Refuses to run against a production environment.
 *
 *   pnpm db:seed
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { categories, coupons, products, reviewers, reviews } from "./seed-data";
import { imageFileName } from "../scripts/generate-product-art";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "yes") {
  console.error("Refusing to seed a production environment. Set ALLOW_PRODUCTION_SEED=yes for a demo deployment.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/** Fixed reference date so "newest" ordering is reproducible. */
const SEED_DATE = new Date("2026-10-20T09:00:00Z");
const daysAgo = (d: number) => new Date(SEED_DATE.getTime() - d * 86_400_000);

async function main() {
  const reviewerEmails = reviewers.map((r) => r.email);

  // Order matters: children before parents.
  await db.$transaction([
    db.order.deleteMany({ where: { email: { in: reviewerEmails } } }),
    db.review.deleteMany({}),
    db.cartItem.deleteMany({}),
    db.wishlistItem.deleteMany({}),
    db.productImage.deleteMany({}),
    db.productVariant.deleteMany({}),
    db.product.deleteMany({}),
    db.coupon.deleteMany({}),
    db.category.deleteMany({}),
    db.user.deleteMany({ where: { email: { in: reviewerEmails } } }),
  ]);

  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.create({ data: c });
    categoryIds.set(c.slug, row.id);
  }

  const variantIds = new Map<string, string>();
  const productIds = new Map<string, string>();
  for (const p of products) {
    const createdAt = daysAgo(p.ageDays);
    const product = await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        categoryId: categoryIds.get(p.category)!,
        status: "ACTIVE",
        specs: p.specs,
        features: p.features,
        unitsSold: p.unitsSold,
        featured: p.featured ?? false,
        createdAt,
        variants: {
          create: p.variants.map((v, position) => ({ ...v, colorHex: v.colorHex ?? null, position })),
        },
      },
      include: { variants: true },
    });
    productIds.set(p.slug, product.id);
    for (const v of product.variants) variantIds.set(v.sku, v.id);

    const alt = (view: string, variant?: string) =>
      `${p.name}${variant ? ` in ${variant}` : ""}, ${view === "front" ? "front view" : "close-up"}`;
    const images: { url: string; alt: string; variantId: string | null; position: number }[] = [
      { url: `/products/${imageFileName(p.slug, null, "front")}`, alt: alt("front", p.variants[0]!.name), variantId: null, position: 0 },
      { url: `/products/${imageFileName(p.slug, null, "detail")}`, alt: alt("detail", p.variants[0]!.name), variantId: null, position: 1 },
    ];
    if (new Set(p.variants.map((v) => v.colorHex)).size > 1) {
      for (const v of product.variants) {
        images.push({ url: `/products/${imageFileName(p.slug, v.sku, "front")}`, alt: alt("front", v.name), variantId: v.id, position: 0 });
        images.push({ url: `/products/${imageFileName(p.slug, null, "detail")}`, alt: alt("detail", p.variants[0]!.name), variantId: v.id, position: 1 });
      }
    }
    await db.productImage.createMany({
      data: images.map((i) => ({ ...i, productId: product.id, width: 1200, height: 1200 })),
    });
  }

  for (const c of coupons) {
    await db.coupon.create({
      data: {
        code: c.code,
        type: c.type,
        value: c.value,
        minSubtotalCents: c.minSubtotalCents,
        maxRedemptions: c.maxRedemptions ?? null,
        endsAt: c.endsAt ?? null,
        categoryId: c.categorySlug ? (categoryIds.get(c.categorySlug) ?? null) : null,
      },
    });
  }

  // Reviewers get a delivered order for each product they review, so every
  // "verified purchase" badge is backed by data.
  const userIds = await Promise.all(
    reviewers.map((r) =>
      db.user.create({ data: { id: randomUUID(), name: r.name, email: r.email, emailVerified: true } }),
    ),
  );
  for (const [i, r] of reviews.entries()) {
    const product = products.find((p) => p.slug === r.product)!;
    const variant = product.variants[0]!;
    const user = userIds[r.reviewer]!;
    const shipping = variant.priceCents >= 9900 ? 0 : 690;
    const createdAt = daysAgo(30 - i);
    await db.order.create({
      data: {
        userId: user.id,
        email: user.email,
        status: "DELIVERED",
        subtotalCents: variant.priceCents,
        shippingCents: shipping,
        totalCents: variant.priceCents + shipping,
        shippingMethod: "STANDARD",
        shipFullName: user.name,
        shipLine1: "1 rue de l'Exemple",
        shipPostalCode: "34000",
        shipCity: "Montpellier",
        shipCountry: "FR",
        paidAt: createdAt,
        createdAt,
        items: {
          create: {
            variantId: variantIds.get(variant.sku)!,
            productId: productIds.get(product.slug)!,
            productSlug: product.slug,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            unitPriceCents: variant.priceCents,
            quantity: 1,
            lineTotalCents: variant.priceCents,
          },
        },
      },
    });
    await db.review.create({
      data: {
        productId: productIds.get(product.slug)!,
        userId: user.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: "APPROVED",
        verifiedPurchase: true,
        createdAt: daysAgo(20 - i),
      },
    });
  }

  console.log(
    `seeded ${categories.length} categories, ${products.length} products, ${variantIds.size} variants, ${coupons.length} coupons, ${reviews.length} reviews`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
