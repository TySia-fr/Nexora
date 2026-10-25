# ADR-0002 — Integer cents and immutable order snapshots

**Status:** accepted · 2026-10-25

## Decision

- All amounts are `Int` cents plus an explicit `Currency` enum. No floats.
- `OrderItem` copies product name, variant name, SKU and unit price at purchase.
  `Order` copies the shipping address and coupon code.
- `CHECK` constraints in Postgres enforce `total = subtotal − discount + shipping`,
  `lineTotal = unitPrice × quantity`, non-negative stock and valid ratings.

## Why

A product renamed or repriced tomorrow must not change last month's invoice.
Constraints catch bugs that slip past application code.

## Trade-off

Prisma cannot express CHECK constraints, so they live in a hand-written
migration (`*_integrity_checks`). Prisma's drift check ignores them; integration
tests assert they exist by triggering them.
