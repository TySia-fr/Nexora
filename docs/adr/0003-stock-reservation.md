# ADR-0003 — Stock is reserved at checkout with conditional updates

**Status:** accepted · 2026-10-25

## Decision
When a customer starts payment, one transaction:
1. creates the `Order` (`PENDING_PAYMENT`, `reservedUntil = now + 30 min`);
2. for each line runs `UPDATE "ProductVariant" SET stock = stock - $q
   WHERE id = $id AND stock >= $q AND "isActive"`; if any update touches 0 rows,
   the whole transaction rolls back and the customer sees which item ran out.

Stock returns to the shelf when Stripe reports the session expired or failed,
or when an admin cancels an unpaid order.

## Why not decrement after payment?
Two people could pay for the last unit. Refunding one of them is worse than
holding a unit for 30 minutes.

## Why not `SELECT … FOR UPDATE`?
The conditional `UPDATE` is atomic on its own, takes the row lock only for the
statement, and cannot be forgotten by a future code path.
