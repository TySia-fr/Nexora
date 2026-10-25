import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, ProductStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { categorySchema, couponSchema, productSchema, type ProductInput } from "@/lib/validation/admin";
import { fieldErrors } from "@/lib/validation/checkout";

/**
 * Admin domain logic. Callers must have passed `requireAdmin()`; every
 * function takes the acting admin's id and writes an audit entry.
 */

export const LOW_STOCK_THRESHOLD = 5;
export const ADMIN_PAGE_SIZE = 20;

function invalid(error: import("zod").ZodError): never {
  throw new AppError("VALIDATION", "Check the highlighted fields.", { fieldErrors: fieldErrors(error) });
}

async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  data: object = {},
) {
  await tx.auditLog.create({
    data: { actorId, action, entity, entityId, data: data as Prisma.InputJsonValue },
  });
}

function uniqueViolation(e: unknown, target: string): AppError | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return new AppError("CONFLICT", `That ${target} is already in use.`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const paidStatuses: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];
  const [revenue, awaitingFulfilment, lowStock, recentOrders, productCount] = await Promise.all([
    db.order.aggregate({
      where: { status: { in: paidStatuses }, paidAt: { gte: since } },
      _sum: { totalCents: true },
      _count: true,
    }),
    db.order.count({ where: { status: "PAID" } }),
    db.productVariant.findMany({
      where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD }, product: { status: "ACTIVE" } },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, sku: true, name: true, stock: true, product: { select: { id: true, name: true } } },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        number: true,
        email: true,
        status: true,
        totalCents: true,
        createdAt: true,
        shipFullName: true,
      },
    }),
    db.product.groupBy({ by: ["status"], _count: true }),
  ]);
  const revenueCents = revenue._sum.totalCents ?? 0;
  return {
    revenueCents,
    paidOrders: revenue._count,
    averageOrderCents: revenue._count ? Math.round(revenueCents / revenue._count) : 0,
    awaitingFulfilment,
    lowStock,
    recentOrders,
    products: Object.fromEntries(productCount.map((p) => [p.status, p._count])) as Partial<
      Record<ProductStatus, number>
    >,
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function listOrders(opts: { status?: OrderStatus; q?: string; page: number }) {
  const where: Prisma.OrderWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q
      ? {
          OR: [
            { email: { contains: opts.q, mode: "insensitive" } },
            { shipFullName: { contains: opts.q, mode: "insensitive" } },
            ...(/^\d+$/.test(opts.q.replace(/^NX-/i, ""))
              ? [{ number: Number(opts.q.replace(/^NX-/i, "")) }]
              : []),
          ],
        }
      : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { _count: { select: { items: true } } },
    }),
    db.order.count({ where }),
  ]);
  return { orders, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function getOrderAdmin(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getOrderHistory(id: string) {
  return db.auditLog.findMany({
    where: { entity: "Order", entityId: id },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProductsAdmin(opts: { q?: string; status?: ProductStatus; page: number }) {
  const where: Prisma.ProductWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: opts.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (opts.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        variants: { select: { stock: true, priceCents: true, isActive: true } },
      },
    }),
    db.product.count({ where }),
  ]);
  return { products, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function getProductAdmin(id: string) {
  return db.product.findUnique({
    where: { id },
    include: { variants: { orderBy: { position: "asc" } }, images: { orderBy: { position: "asc" } } },
  });
}

/**
 * Creates or updates a product with its variants in one transaction.
 * Variants removed from the form are deactivated when they appear in past
 * orders (history stays intact) and deleted otherwise.
 */
export async function saveProduct(actorId: string, productId: string | null, raw: unknown): Promise<string> {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) invalid(parsed.error);
  const input: ProductInput = parsed.data;
  const skus = input.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    throw new AppError("VALIDATION", "Each variant needs a different SKU.");
  }

  try {
    return await db.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });
      if (!category)
        throw new AppError("VALIDATION", "Choose a valid category.", {
          fieldErrors: { categoryId: "Choose a valid category." },
        });

      const data = {
        name: input.name,
        slug: input.slug,
        tagline: input.tagline,
        description: input.description,
        categoryId: input.categoryId,
        status: input.status,
        featured: input.featured,
        specs: input.specs,
        features: input.features,
      };

      let id: string;
      if (productId) {
        const existing = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!existing) throw new AppError("NOT_FOUND", "Product not found.");
        await tx.product.update({ where: { id: productId }, data });
        id = productId;
      } else {
        id = (await tx.product.create({ data, select: { id: true } })).id;
      }

      const current = await tx.productVariant.findMany({ where: { productId: id }, select: { id: true } });
      const keep = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])));
      for (const v of current) {
        if (keep.has(v.id)) continue;
        const ordered = await tx.orderItem.count({ where: { variantId: v.id } });
        if (ordered > 0) await tx.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
        else await tx.productVariant.delete({ where: { id: v.id } });
      }

      for (const [position, v] of input.variants.entries()) {
        const fields = {
          sku: v.sku,
          name: v.name,
          colorHex: v.colorHex ?? null,
          priceCents: v.price,
          stock: v.stock,
          isActive: v.isActive,
          position,
        };
        if (v.id && current.some((c) => c.id === v.id)) {
          // Stock of existing variants is never overwritten from this form: a
          // sale between page load and save would be lost. Use adjustStock().
          const { stock: _ignored, ...withoutStock } = fields;
          await tx.productVariant.update({ where: { id: v.id }, data: withoutStock });
        } else {
          await tx.productVariant.create({ data: { ...fields, productId: id } });
        }
      }

      await audit(tx, actorId, productId ? "product.update" : "product.create", "Product", id, {
        status: input.status,
        variants: input.variants.length,
      });
      return id;
    });
  } catch (e) {
    throw uniqueViolation(e, "slug or SKU") ?? e;
  }
}

/** Deletes only products that were never ordered; others must be archived. */
export async function deleteProduct(actorId: string, productId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const ordered = await tx.orderItem.count({ where: { productId } });
    if (ordered > 0) {
      throw new AppError(
        "CONFLICT",
        "This product appears in past orders. Archive it instead of deleting it.",
      );
    }
    const { count } = await tx.product.deleteMany({ where: { id: productId } });
    if (count === 0) throw new AppError("NOT_FOUND", "Product not found.");
    await audit(tx, actorId, "product.delete", "Product", productId);
  });
}

export async function adjustStock(actorId: string, variantId: string, delta: number): Promise<number> {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10_000) {
    throw new AppError("VALIDATION", "Enter a non-zero whole number.");
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.$queryRaw<{ stock: number }[]>`
      UPDATE "ProductVariant" SET "stock" = "stock" + ${delta}, "updatedAt" = now()
      WHERE "id" = ${variantId} AND "stock" + ${delta} >= 0
      RETURNING "stock"
    `;
    if (updated.length === 0) throw new AppError("VALIDATION", "Stock can't go below zero.");
    await audit(tx, actorId, "stock.adjust", "ProductVariant", variantId, { delta });
    return updated[0]!.stock;
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategoriesAdmin() {
  return db.category.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function saveCategory(actorId: string, id: string | null, raw: unknown) {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) invalid(parsed.error);
  try {
    await db.$transaction(async (tx) => {
      const row = id
        ? await tx.category.update({ where: { id }, data: parsed.data })
        : await tx.category.create({ data: parsed.data });
      await audit(tx, actorId, id ? "category.update" : "category.create", "Category", row.id);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      throw new AppError("NOT_FOUND", "Category not found.");
    throw uniqueViolation(e, "slug") ?? e;
  }
}

export async function deleteCategory(actorId: string, id: string) {
  await db.$transaction(async (tx) => {
    const products = await tx.product.count({ where: { categoryId: id } });
    if (products > 0) throw new AppError("CONFLICT", "Move or delete this category's products first.");
    const { count } = await tx.category.deleteMany({ where: { id } });
    if (count === 0) throw new AppError("NOT_FOUND", "Category not found.");
    await audit(tx, actorId, "category.delete", "Category", id);
  });
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function listCoupons() {
  return db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });
}

export async function createCoupon(actorId: string, raw: unknown) {
  const parsed = couponSchema.safeParse(raw);
  if (!parsed.success) invalid(parsed.error);
  try {
    await db.$transaction(async (tx) => {
      const c = await tx.coupon.create({ data: parsed.data });
      await audit(tx, actorId, "coupon.create", "Coupon", c.id, { code: c.code });
    });
  } catch (e) {
    throw uniqueViolation(e, "code") ?? e;
  }
}

export async function setCouponActive(actorId: string, id: string, isActive: boolean) {
  await db.$transaction(async (tx) => {
    const { count } = await tx.coupon.updateMany({ where: { id }, data: { isActive } });
    if (count === 0) throw new AppError("NOT_FOUND", "Coupon not found.");
    await audit(tx, actorId, isActive ? "coupon.enable" : "coupon.disable", "Coupon", id);
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function listReviewsAdmin(status: "PENDING" | "APPROVED" | "REJECTED", page: number) {
  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        product: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.review.count({ where: { status } }),
  ]);
  return { reviews, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function moderateReview(actorId: string, id: string, status: "APPROVED" | "REJECTED") {
  await db.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({ where: { id }, data: { status } });
    if (count === 0) throw new AppError("NOT_FOUND", "Review not found.");
    await audit(tx, actorId, `review.${status.toLowerCase()}`, "Review", id);
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Minimal lookup: identity, order count and lifetime paid value. No secrets. */
export async function searchCustomers(q: string | undefined, page: number) {
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
      }
    : {};
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  const paid = await db.order.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
    _sum: { totalCents: true },
  });
  const paidBy = new Map(paid.map((p) => [p.userId, p._sum.totalCents ?? 0]));
  return {
    customers: users.map((u) => ({ ...u, paidCents: paidBy.get(u.id) ?? 0 })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}
