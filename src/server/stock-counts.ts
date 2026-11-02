import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { markStockChanged } from "@/server/catalog";
import { moveStock } from "@/server/inventory";
import { countEntriesSchema, openCountSchema } from "@/lib/validation/inventory";
import { fieldErrors } from "@/lib/validation/checkout";

/**
 * Stock counts (physical stock-takes), ADR-0010.
 *
 * Opening a count freezes, per variant, the units that should be on the shelf:
 * available stock + units held by orders that haven't shipped (PENDING_PAYMENT, PAID).
 * Sales during the count don't change that number (stock goes down, held goes up);
 * shipments, receipts and manual movements do, so those lines are flagged for a recount.
 *
 * Committing applies `counted - expected` to each counted line as a COUNT_CORRECTION
 * movement, all in one transaction. Only one count can be open at a time.
 */

/** Serialises opening counts, so two admins can't open two at once. */
const COUNT_LOCK = 4_242_001;

export function formatCountNumber(n: number): string {
  return `SC-${n}`;
}

function invalid(error: import("zod").ZodError): never {
  throw new AppError("VALIDATION", "Check the highlighted fields.", { fieldErrors: fieldErrors(error) });
}

export async function openCount(actorId: string, raw: unknown): Promise<string> {
  const parsed = openCountSchema.safeParse(raw);
  if (!parsed.success) invalid(parsed.error);
  const { categoryId, note } = parsed.data;

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COUNT_LOCK})`;
    const open = await tx.stockCount.findFirst({ where: { status: "OPEN" }, select: { number: true } });
    if (open) {
      throw new AppError(
        "CONFLICT",
        `${formatCountNumber(open.number)} is still open. Commit or cancel it before starting another.`,
      );
    }
    if (categoryId && !(await tx.category.count({ where: { id: categoryId } }))) {
      throw new AppError("NOT_FOUND", "Category not found.");
    }
    const count = await tx.stockCount.create({
      data: { categoryId, note, createdById: actorId },
      select: { id: true, number: true },
    });
    // Expected quantities, frozen in the same transaction as the count row.
    const inserted = await tx.$executeRaw`
      INSERT INTO "StockCountLine" ("id", "countId", "variantId", "expected", "baselineAt", "updatedAt")
      SELECT gen_random_uuid()::text, ${count.id}, v."id",
             v."stock" + COALESCE(held.units, 0), now(), now()
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      LEFT JOIN (
        SELECT oi."variantId", SUM(oi."quantity") AS units
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."status" IN ('PENDING_PAYMENT', 'PAID')
        GROUP BY oi."variantId"
      ) held ON held."variantId" = v."id"
      WHERE v."isActive" AND p."status" <> 'ARCHIVED'
        ${categoryId ? Prisma.sql`AND p."categoryId" = ${categoryId}` : Prisma.empty}
    `;
    if (inserted === 0) throw new AppError("VALIDATION", "There is nothing to count in that category.");
    await tx.auditLog.create({
      data: {
        actorId,
        action: "count.open",
        entity: "StockCount",
        entityId: count.id,
        data: { lines: inserted, categoryId },
      },
    });
    return count.id;
  });
}

/** Saves counted quantities. Can be called many times while the count is open. */
export async function recordCounts(actorId: string, raw: unknown): Promise<number> {
  const parsed = countEntriesSchema.safeParse(raw);
  if (!parsed.success) invalid(parsed.error);
  const { countId, entries } = parsed.data;
  return db.$transaction(async (tx) => {
    const count = await tx.stockCount.findUnique({ where: { id: countId }, select: { status: true } });
    if (!count) throw new AppError("NOT_FOUND", "Count not found.");
    if (count.status !== "OPEN") throw new AppError("CONFLICT", "This count is closed.");
    let saved = 0;
    for (const e of entries) {
      // Scoped to this count: a line id from another count is simply not matched.
      const { count: n } = await tx.stockCountLine.updateMany({
        where: { id: e.lineId, countId },
        data: { counted: e.counted },
      });
      saved += n;
    }
    await tx.auditLog.create({
      data: { actorId, action: "count.record", entity: "StockCount", entityId: countId, data: { saved } },
    });
    return saved;
  });
}

/**
 * Lines whose expected quantity may be out of date: something moved stock on or off
 * the shelf since the count opened (a shipment, a receipt, a write-off, a correction).
 */
async function staleLineVariants(countId: string): Promise<Set<string>> {
  const rows = await db.$queryRaw<{ variantId: string }[]>`
    SELECT DISTINCT l."variantId"
    FROM "StockCountLine" l
    WHERE l."countId" = ${countId} AND (
      EXISTS (
        SELECT 1 FROM "StockMovement" m
        WHERE m."variantId" = l."variantId" AND m."createdAt" > l."baselineAt"
          AND m."reason" IN ('RECEIVED', 'RETURNED', 'DAMAGED', 'ADJUSTMENT', 'COUNT_CORRECTION', 'OPENING_BALANCE')
      )
      OR EXISTS (
        SELECT 1 FROM "AuditLog" a
        JOIN "OrderItem" oi ON oi."orderId" = a."entityId"
        WHERE a."entity" = 'Order' AND a."action" = 'order.transition'
          AND a."data"->>'to' = 'SHIPPED' AND a."createdAt" > l."baselineAt"
          AND oi."variantId" = l."variantId"
      )
    )
  `;
  return new Set(rows.map((r) => r.variantId));
}

/** Re-freezes expected quantities of stale lines and clears them for a recount. */
export async function refreshStaleLines(actorId: string, countId: string): Promise<number> {
  const count = await db.stockCount.findUnique({ where: { id: countId }, select: { status: true } });
  if (!count) throw new AppError("NOT_FOUND", "Count not found.");
  if (count.status !== "OPEN") throw new AppError("CONFLICT", "This count is closed.");
  const stale = [...(await staleLineVariants(countId))];
  if (stale.length === 0) return 0;
  return db.$transaction(async (tx) => {
    const n = await tx.$executeRaw`
      UPDATE "StockCountLine" l
      SET "expected" = v."stock" + COALESCE((
            SELECT SUM(oi."quantity") FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
            WHERE oi."variantId" = v."id" AND o."status" IN ('PENDING_PAYMENT', 'PAID')
          ), 0),
          "counted" = NULL, "baselineAt" = now(), "updatedAt" = now()
      FROM "ProductVariant" v
      WHERE l."variantId" = v."id" AND l."countId" = ${countId} AND l."variantId" IN (${Prisma.join(stale)})
    `;
    await tx.auditLog.create({
      data: { actorId, action: "count.refresh", entity: "StockCount", entityId: countId, data: { lines: n } },
    });
    return n;
  });
}

export async function commitCount(
  actorId: string,
  countId: string,
): Promise<{ corrected: number; skipped: number }> {
  const result = await db.$transaction(
    async (tx) => {
      // Closing first, conditionally: a second commit (double click, two tabs) finds
      // nothing to close and stops before any correction is applied twice.
      const { count: closed } = await tx.stockCount.updateMany({
        where: { id: countId, status: "OPEN" },
        data: { status: "COMMITTED", closedById: actorId, closedAt: new Date() },
      });
      if (closed === 0) throw new AppError("CONFLICT", "This count is already closed.");

      const lines = await tx.stockCountLine.findMany({
        where: { countId },
        include: { variant: { select: { sku: true } } },
      });
      let corrected = 0;
      let skipped = 0;
      for (const line of lines) {
        if (line.counted === null) {
          skipped++;
          continue;
        }
        const variance = line.counted - line.expected;
        if (variance === 0) continue;
        const moved = await moveStock(tx, {
          variantId: line.variantId,
          delta: variance,
          reason: "COUNT_CORRECTION",
          countId,
          actorId,
          note: `Counted ${line.counted}, expected ${line.expected}`,
        });
        if (!moved) {
          throw new AppError(
            "CONFLICT",
            `${line.variant.sku}: the correction would take available stock below zero, because units ` +
              "held by open orders aren't on the shelf. Recount it before committing.",
          );
        }
        corrected++;
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: "count.commit",
          entity: "StockCount",
          entityId: countId,
          data: { corrected, skipped },
        },
      });
      return { corrected, skipped };
    },
    { timeout: 30_000 },
  );
  markStockChanged();
  return result;
}

export async function cancelCount(actorId: string, countId: string): Promise<void> {
  const { count } = await db.stockCount.updateMany({
    where: { id: countId, status: "OPEN" },
    data: { status: "CANCELLED", closedById: actorId, closedAt: new Date() },
  });
  if (count === 0) throw new AppError("CONFLICT", "This count is already closed.");
  await db.auditLog.create({
    data: { actorId, action: "count.cancel", entity: "StockCount", entityId: countId },
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listCounts() {
  return db.stockCount.findMany({
    orderBy: { number: "desc" },
    take: 50,
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: { select: { expected: true, counted: true } },
    },
  });
}

export async function getCount(countId: string) {
  const count = await db.stockCount.findUnique({
    where: { id: countId },
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      lines: {
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              costCents: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: [{ variant: { product: { name: "asc" } } }, { variant: { position: "asc" } }],
      },
    },
  });
  if (!count) return null;
  const stale = count.status === "OPEN" ? await staleLineVariants(count.id) : new Set<string>();
  let countedLines = 0;
  let varianceUnits = 0;
  let varianceCostCents = 0;
  let unknownCost = 0;
  const lines = count.lines.map((l) => {
    const variance = l.counted === null ? null : l.counted - l.expected;
    if (variance !== null) {
      countedLines++;
      varianceUnits += variance;
      if (l.variant.costCents === null) unknownCost += variance === 0 ? 0 : 1;
      else varianceCostCents += variance * l.variant.costCents;
    }
    return { ...l, variance, stale: stale.has(l.variantId) };
  });
  return {
    ...count,
    lines,
    summary: {
      lines: lines.length,
      counted: countedLines,
      varianceUnits,
      varianceCostCents,
      unknownCost,
      stale: stale.size,
    },
  };
}
