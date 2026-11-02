import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { StockMovementReason } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { markStockChanged } from "@/server/catalog";
import { adjustmentSchema, variantSettingsSchema, type InventoryFilter } from "@/lib/validation/inventory";
import { fieldErrors } from "@/lib/validation/checkout";
import { daysOfCover, stockLevel, type StockLevel } from "@/lib/inventory";

/**
 * Inventory ledger (ADR-0010).
 *
 * `ProductVariant.stock` is the number of units available to sell. Every change to
 * it goes through `moveStock`, which updates the row and appends a StockMovement in
 * the same transaction, so for every variant SUM(delta) = stock. Physical units on
 * the shelf are higher than `stock` while orders hold units they haven't shipped yet.
 */

export type Movement = {
  variantId: string;
  delta: number;
  reason: StockMovementReason;
  note?: string | null;
  orderId?: string | null;
  countId?: string | null;
  actorId?: string | null;
  /** Refuse inactive variants (checkout); admin corrections may touch them. */
  requireActive?: boolean;
};

/**
 * Applies a stock change and records it. The UPDATE is conditional, so concurrent
 * movements can never take stock below zero (ADR-0003). Returns null when refused.
 */
export async function moveStock(
  tx: Tx,
  m: Movement,
): Promise<{ stockAfter: number; movementId: string } | null> {
  if (!Number.isInteger(m.delta) || m.delta === 0) {
    throw new AppError("VALIDATION", "A stock movement must be a non-zero whole number.");
  }
  const active = m.requireActive ? Prisma.sql`AND "isActive"` : Prisma.empty;
  const rows = await tx.$queryRaw<{ stock: number }[]>`
    UPDATE "ProductVariant" SET "stock" = "stock" + ${m.delta}, "updatedAt" = now()
    WHERE "id" = ${m.variantId} AND "stock" + ${m.delta} >= 0 ${active}
    RETURNING "stock"
  `;
  if (rows.length === 0) return null;
  const stockAfter = rows[0]!.stock;
  const movement = await tx.stockMovement.create({
    data: {
      variantId: m.variantId,
      delta: m.delta,
      stockAfter,
      reason: m.reason,
      note: m.note ?? null,
      orderId: m.orderId ?? null,
      countId: m.countId ?? null,
      actorId: m.actorId ?? null,
    },
    select: { id: true },
  });
  return { stockAfter, movementId: movement.id };
}

/** Records the stock a newly created variant starts with. */
export async function recordOpeningBalance(tx: Tx, variantId: string, stock: number, actorId: string) {
  if (stock <= 0) return;
  await tx.stockMovement.create({
    data: { variantId, delta: stock, stockAfter: stock, reason: "OPENING_BALANCE", actorId },
  });
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

async function audit(tx: Tx, actorId: string, action: string, entityId: string, data: object) {
  await tx.auditLog.create({
    data: { actorId, action, entity: "ProductVariant", entityId, data: data as Prisma.InputJsonValue },
  });
}

/** Manual movement: goods received, a return, a write-off or a correction. */
export async function adjustStock(actorId: string, raw: unknown): Promise<number> {
  const parsed = adjustmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Check the highlighted fields.", {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  const input = parsed.data;
  const stockAfter = await db.$transaction(async (tx) => {
    const moved = await moveStock(tx, {
      variantId: input.variantId,
      delta: input.delta,
      reason: input.reason,
      note: input.note,
      actorId,
    });
    if (!moved) {
      const exists = await tx.productVariant.count({ where: { id: input.variantId } });
      if (!exists) throw new AppError("NOT_FOUND", "Variant not found.");
      throw new AppError("VALIDATION", "Stock can't go below zero.");
    }
    await audit(tx, actorId, "stock.adjust", input.variantId, {
      delta: input.delta,
      reason: input.reason,
    });
    return moved.stockAfter;
  });
  markStockChanged();
  return stockAfter;
}

export async function updateVariantSettings(actorId: string, raw: unknown): Promise<void> {
  const parsed = variantSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Check the highlighted fields.", {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  const { variantId, reorderPoint, costCents } = parsed.data;
  await db.$transaction(async (tx) => {
    const { count } = await tx.productVariant.updateMany({
      where: { id: variantId },
      data: { reorderPoint, costCents },
    });
    if (count === 0) throw new AppError("NOT_FOUND", "Variant not found.");
    await audit(tx, actorId, "variant.settings", variantId, { reorderPoint, costCents });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type InventoryRow = {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  variantName: string;
  categoryName: string;
  productStatus: string;
  isActive: boolean;
  priceCents: number;
  costCents: number | null;
  reorderPoint: number;
  /** Available to sell. */
  available: number;
  /** Held by unpaid orders (PENDING_PAYMENT). */
  reserved: number;
  /** Paid, not shipped yet. */
  toShip: number;
  /** On the shelf: available + reserved + toShip. */
  onHand: number;
  unitsSold30d: number;
  coverDays: number | null;
  level: StockLevel;
  lastMovementAt: Date | null;
};

type RawRow = Omit<
  InventoryRow,
  "onHand" | "coverDays" | "level" | "reserved" | "toShip" | "unitsSold30d"
> & {
  reserved: bigint;
  toShip: bigint;
  unitsSold30d: bigint;
};

/** Units held by orders that haven't left the warehouse, per variant. */
const COMMITTED_SQL = Prisma.sql`
  SELECT oi."variantId",
         SUM(oi."quantity") FILTER (WHERE o."status" = 'PENDING_PAYMENT') AS reserved,
         SUM(oi."quantity") FILTER (WHERE o."status" = 'PAID') AS to_ship
  FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
  WHERE o."status" IN ('PENDING_PAYMENT', 'PAID') AND oi."variantId" IS NOT NULL
  GROUP BY oi."variantId"
`;

/**
 * One row per variant with available, held and on-hand quantities, recent sales and
 * days of cover. Computed in one query so the numbers on the page are consistent.
 */
export async function getInventory(filter: InventoryFilter): Promise<{
  rows: InventoryRow[];
  totals: { onHand: number; valueAtCostCents: number; valueAtRetailCents: number; unknownCost: number };
}> {
  const like = filter.q ? `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await db.$queryRaw<RawRow[]>`
    WITH committed AS (${COMMITTED_SQL}),
    sold AS (
      SELECT oi."variantId", SUM(oi."quantity") AS units
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" IN ('PAID', 'SHIPPED', 'DELIVERED')
        AND o."paidAt" >= now() - interval '30 days'
      GROUP BY oi."variantId"
    ),
    last_move AS (
      SELECT "variantId", MAX("createdAt") AS at FROM "StockMovement" GROUP BY "variantId"
    )
    SELECT v."id" AS "variantId", v."sku", p."id" AS "productId", p."name" AS "productName",
           v."name" AS "variantName", c."name" AS "categoryName", p."status"::text AS "productStatus",
           v."isActive", v."priceCents", v."costCents", v."reorderPoint", v."stock" AS available,
           COALESCE(cm.reserved, 0) AS reserved, COALESCE(cm.to_ship, 0) AS "toShip",
           COALESCE(s.units, 0) AS "unitsSold30d", lm.at AS "lastMovementAt"
    FROM "ProductVariant" v
    JOIN "Product" p ON p."id" = v."productId"
    JOIN "Category" c ON c."id" = p."categoryId"
    LEFT JOIN committed cm ON cm."variantId" = v."id"
    LEFT JOIN sold s ON s."variantId" = v."id"
    LEFT JOIN last_move lm ON lm."variantId" = v."id"
    WHERE p."status" <> 'ARCHIVED'
      ${filter.category ? Prisma.sql`AND c."slug" = ${filter.category}` : Prisma.empty}
      ${like ? Prisma.sql`AND (v."sku" ILIKE ${like} OR p."name" ILIKE ${like} OR v."name" ILIKE ${like})` : Prisma.empty}
    ORDER BY p."name", v."position"
  `;

  const all: InventoryRow[] = rows.map((r) => {
    const reserved = Number(r.reserved);
    const toShip = Number(r.toShip);
    const unitsSold30d = Number(r.unitsSold30d);
    return {
      ...r,
      reserved,
      toShip,
      unitsSold30d,
      onHand: r.available + reserved + toShip,
      coverDays: daysOfCover(r.available, unitsSold30d, 30),
      level: stockLevel(r.available, r.reorderPoint, r.isActive),
    };
  });

  const filtered = filter.level === "all" ? all : all.filter((r) => r.level === filter.level);
  const sorted = [...filtered].sort(SORTERS[filter.sort]);

  let valueAtCostCents = 0;
  let valueAtRetailCents = 0;
  let unknownCost = 0;
  let onHand = 0;
  for (const r of sorted) {
    onHand += r.onHand;
    valueAtRetailCents += r.onHand * r.priceCents;
    if (r.costCents === null) unknownCost += r.onHand > 0 ? 1 : 0;
    else valueAtCostCents += r.onHand * r.costCents;
  }
  return { rows: sorted, totals: { onHand, valueAtCostCents, valueAtRetailCents, unknownCost } };
}

const LEVEL_ORDER: Record<StockLevel, number> = { out: 0, low: 1, ok: 2, inactive: 3 };

const SORTERS: Record<InventoryFilter["sort"], (a: InventoryRow, b: InventoryRow) => number> = {
  name: () => 0, // SQL order
  urgency: (a, b) =>
    LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
    (a.coverDays ?? Infinity) - (b.coverDays ?? Infinity) ||
    a.available - b.available,
  available: (a, b) => a.available - b.available,
  sold: (a, b) => b.unitsSold30d - a.unitsSold30d,
  value: (a, b) => b.onHand * (b.costCents ?? 0) - a.onHand * (a.costCents ?? 0),
};

export type VariantLedger = Awaited<ReturnType<typeof getVariantLedger>>;

/** A variant's details, held quantities and its movements, newest first. */
export async function getVariantLedger(variantId: string, page = 1, pageSize = 30) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      reorderPoint: true,
      costCents: true,
      priceCents: true,
      isActive: true,
      product: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!variant) return null;
  const [movements, total, sum, committed] = await Promise.all([
    db.stockMovement.findMany({
      where: { variantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { name: true } },
        order: { select: { id: true, number: true } },
        count: { select: { id: true, number: true } },
      },
    }),
    db.stockMovement.count({ where: { variantId } }),
    db.stockMovement.aggregate({ where: { variantId }, _sum: { delta: true } }),
    db.$queryRaw<{ reserved: bigint | null; to_ship: bigint | null }[]>`
      WITH committed AS (${COMMITTED_SQL}) SELECT reserved, to_ship FROM committed WHERE "variantId" = ${variantId}
    `,
  ]);
  const reserved = Number(committed[0]?.reserved ?? 0);
  const toShip = Number(committed[0]?.to_ship ?? 0);
  const ledgerSum = sum._sum.delta ?? 0;
  return {
    variant,
    movements,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    reserved,
    toShip,
    onHand: variant.stock + reserved + toShip,
    /** The ledger invariant: false means stock was changed outside moveStock. */
    reconciled: ledgerSum === variant.stock,
    ledgerSum,
  };
}

/** Movements across all variants, newest first (for the journal view). */
export async function getRecentMovements(limit = 12) {
  return db.stockMovement.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      variant: { select: { id: true, sku: true, name: true, product: { select: { name: true } } } },
      actor: { select: { name: true } },
      order: { select: { id: true, number: true } },
    },
  });
}

/** Variants whose stock no longer equals the sum of their movements. Should be empty. */
export async function findUnreconciledVariants(): Promise<
  { id: string; sku: string; stock: number; ledger: number }[]
> {
  const rows = await db.$queryRaw<{ id: string; sku: string; stock: number; ledger: bigint }[]>`
    SELECT v."id", v."sku", v."stock", COALESCE(SUM(m."delta"), 0) AS ledger
    FROM "ProductVariant" v LEFT JOIN "StockMovement" m ON m."variantId" = v."id"
    GROUP BY v."id"
    HAVING v."stock" <> COALESCE(SUM(m."delta"), 0)
  `;
  return rows.map((r) => ({ ...r, ledger: Number(r.ledger) }));
}
