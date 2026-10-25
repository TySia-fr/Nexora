# ADR-0001 — Modular monolith on Next.js App Router

**Status:** accepted · 2026-10-25

## Context

NEXORA needs a storefront, an account area, an admin area, payment webhooks and
background-free order logic. One developer maintains it.

## Decision

One Next.js 16 application. Code is split by responsibility, not by framework
feature:

- `src/app/` — routes only: read params, call a service, render.
- `src/server/` — domain services (catalog, cart, pricing, orders, payments,
  admin). The only place that touches the database. Marked `server-only`.
- `src/lib/` — pure helpers (money, validation schemas) with no I/O.
- `src/components/` — UI. Server Components by default; client islands only
  where interaction needs it.

## Consequences

- One deploy, one database, no network hops between "services".
- Domain rules (prices, stock, order transitions) are testable without HTTP.
- If one area ever needs to scale independently, `src/server/*` modules are the
  seams to extract along.
