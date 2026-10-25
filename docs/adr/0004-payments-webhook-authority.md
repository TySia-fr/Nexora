# ADR-0004 — Stripe webhooks are the only source of "paid"

**Status:** accepted · 2026-10-25

## Decision
- Checkout uses Stripe-hosted Checkout Sessions. Card data never reaches NEXORA.
- The success page only *reads* order status. It never marks an order paid.
- `POST /api/webhooks/stripe` verifies the signature against the raw body,
  records the event id in `ProcessedWebhookEvent` inside the same transaction
  as its effects, and ignores ids it has already seen.
- Payment amount and currency in the event must match the order, or the event
  is logged and rejected.
- Live keys are refused at startup (`src/lib/env.ts`): this is a demo store.
- Without Stripe keys, payments are **disabled**, and checkout says so. There is
  no fake "success" mode.
