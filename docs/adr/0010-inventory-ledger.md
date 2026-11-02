# ADR-0010 — Inventory as an append-only ledger, physical counts against "on hand"

**Status:** accepted · 2026-11-02

## Context

Stock was a single number per variant, changed in four places (checkout, release of unpaid orders, admin
adjustments, product creation). That number was correct, but nobody could say _why_ it was what it was:
no history, no reasons, no way to reconcile it with a physical count, and no cost to value it or to compute
margins.

## Decision

**Ledger.** Every stock change goes through `moveStock()`, which runs the existing conditional
`UPDATE … WHERE stock + delta >= 0 RETURNING stock` (ADR-0003) and inserts a `StockMovement` in the same
transaction: delta, stock after, reason, note, the order or count it belongs to, and the admin who made it.
`ProductVariant.stock` stays the fast read; the ledger is the explanation. The invariant
`SUM(delta) = stock` is checked on every variant page and in the integration tests. A migration wrote one
`OPENING_BALANCE` per variant, so production reconciles from the first deploy.

Reasons are an enum. Admins can record goods received, customer returns, write-offs and corrections (which
require a note); reservations, releases and count corrections are written only by the system.

**Available vs on hand.** `stock` is what can be _sold_. What should be on the _shelf_ is
`stock + units in orders not yet shipped` (PENDING_PAYMENT and PAID). Counting shelves against `stock` would
report every unshipped order as missing.

**Counts.** Opening a count freezes the expected on-hand quantity per variant. A sale during the count
lowers `stock` and raises "held" by the same amount, so it never creates a false difference. A shipment,
a receipt or a correction does change what's on the shelf; those lines are flagged (movement or shipment
after the line's `baselineAt`) and can be re-frozen for a recount. Committing applies `counted − expected`
to each counted line as `COUNT_CORRECTION` in one transaction; the status flips first and conditionally,
so a double submit can't apply corrections twice. One count can be open at a time (advisory lock).

**Cost and margin.** Variants have an optional unit cost (ex. VAT). Order lines snapshot it at checkout,
like prices, so a later cost change never rewrites past margins. Analytics excludes lines without a cost
from margin and says how many there were, instead of treating them as free.

## Consequences

- Every unit is traceable to an order, a count or a named admin; the audit log records the actions too.
- Two writes per stock change. Fine at this scale; the ledger would be partitioned by month long before
  it mattered.
- Historic orders (before this change) have no cost and are reported as such.
- Refunds still don't restock automatically: whether a returned unit is sellable is a human decision,
  recorded as a `RETURNED` movement.
