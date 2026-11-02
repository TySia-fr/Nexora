-- Hand-written: invariants for the inventory ledger, and its opening balance.

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_reorder_point_non_negative" CHECK ("reorderPoint" >= 0),
  ADD CONSTRAINT "ProductVariant_cost_non_negative" CHECK ("costCents" IS NULL OR "costCents" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_unit_cost_non_negative" CHECK ("unitCostCents" IS NULL OR "unitCostCents" >= 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_delta_non_zero" CHECK ("delta" <> 0),
  ADD CONSTRAINT "StockMovement_stock_after_non_negative" CHECK ("stockAfter" >= 0);

ALTER TABLE "StockCountLine"
  ADD CONSTRAINT "StockCountLine_quantities_non_negative" CHECK (
    "expected" >= 0 AND ("counted" IS NULL OR "counted" >= 0)
  );

-- The ledger starts now: existing stock becomes one OPENING_BALANCE movement per
-- variant, so SUM(delta) = stock holds for every variant from the first deploy.
-- Costs of past orders are unknown and stay NULL rather than being guessed.
INSERT INTO "StockMovement" ("id", "variantId", "delta", "stockAfter", "reason", "note", "createdAt")
SELECT gen_random_uuid()::text, "id", "stock", "stock", 'OPENING_BALANCE', 'Ledger opened', CURRENT_TIMESTAMP
FROM "ProductVariant"
WHERE "stock" > 0;
