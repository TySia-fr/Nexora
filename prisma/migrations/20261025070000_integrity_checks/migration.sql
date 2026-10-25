-- Hand-written: invariants Prisma's schema language cannot express.
-- The database rejects impossible states even if application code has a bug.

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_stock_non_negative" CHECK ("stock" >= 0),
  ADD CONSTRAINT "ProductVariant_price_non_negative" CHECK ("priceCents" >= 0);

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_range" CHECK ("quantity" BETWEEN 1 AND 99);

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_has_owner" CHECK ("userId" IS NOT NULL OR "guestToken" IS NOT NULL);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amounts_non_negative" CHECK (
    "subtotalCents" >= 0 AND "discountCents" >= 0 AND "shippingCents" >= 0 AND "totalCents" >= 0
  ),
  ADD CONSTRAINT "Order_total_consistent" CHECK (
    "totalCents" = "subtotalCents" - "discountCents" + "shippingCents"
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_line_total_consistent" CHECK ("lineTotalCents" = "unitPriceCents" * "quantity");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_non_negative" CHECK ("amountCents" >= 0);

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_value_valid" CHECK (
    "value" > 0 AND ("type" <> 'PERCENT' OR "value" <= 100)
  ),
  ADD CONSTRAINT "Coupon_redemptions_valid" CHECK (
    "redemptionCount" >= 0 AND ("maxRedemptions" IS NULL OR "redemptionCount" <= "maxRedemptions")
  );

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
