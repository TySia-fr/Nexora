# Testing

## Layers

| Layer       | Tool                  | Where                | Database                                          |
| ----------- | --------------------- | -------------------- | ------------------------------------------------- |
| Unit        | Vitest                | `src/**/*.test.ts`   | none                                              |
| Integration | Vitest                | `tests/integration/` | `TEST_DATABASE_URL` (truncated before each suite) |
| End-to-end  | Playwright + axe-core | `tests/e2e/`         | the app's `DATABASE_URL`, migrated and seeded     |

Integration tests refuse to run unless the database name contains `test`, so they can never wipe dev data.

## What is covered

**Pricing and coupons** — totals, half-up rounding, free-shipping threshold measured after discount, every coupon
rejection reason, category-limited and fixed coupons capped at the eligible amount.

**Catalog** — only active products with active variants, category/price/stock filters, all sort orders, LIKE
wildcards treated literally, out-of-range pages, drafts hidden, suggestion ordering.

**Cart** — quantity caps by stock, invalid quantities, unavailable/draft/out-of-stock products, current prices
always used, problem lines excluded from totals, IDOR between carts, coupon validation, guest-cart merge.

**Orders** — server totals with tampered client fields ignored, immutable snapshots after product changes,
address validation with field errors, empty and changed carts, **8 concurrent checkouts for 3 units → exactly
3 orders, stock 0**, coupon usage limit under concurrency, expired reservations released, status machine,
manual "paid" refused, database CHECK constraints.

**Payments** — bad and tampered signatures rejected, success URL doesn't mark paid, paid exactly once on
redelivery, amount mismatch rejected, delayed payment methods, failed/expired sessions release stock, a late
"paid" can't resurrect a cancelled order, provider outage releases the reservation.

**Admin** — anonymous and customer callers rejected by every privileged action, audit entries, product
validation, duplicate slug/SKU, ordered variants deactivated rather than deleted, ordered products can't be
deleted, stock can't go negative, coupon validation.

**Accounts** — users can't read others' orders or modify others' addresses, single default address,
open-redirect guard, sign-up schema ignores `role`.

**End-to-end** — homepage, filters and sorting via URL, not-found handling, variant selection, keyboard-only
purchase journey, search suggestions with arrow keys, mobile menu focus and Escape, cart totals and coupons on
desktop and phone, checkout honesty when payments are off, unsigned webhook rejected, sign-up/sign-in/sign-out,
generic login errors, open redirect blocked, IDOR on order pages, admin access control and editing. Key pages
are scanned with axe for WCAG 2.1 A/AA.

## Running

```bash
pnpm test                                    # unit + integration

pnpm build
RATE_LIMIT_MULTIPLIER=100 pnpm start &       # many sign-ups come from one IP during the suite
pnpm exec playwright install chromium        # once
E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
```

`RATE_LIMIT_MULTIPLIER` is for tests only; never set it on a public deployment.

### Visual and responsive checks

```bash
node scripts/dev/qa-shots.mjs /tmp/qa / 320 390 768 1024 1440 1600
```

Takes full-page screenshots at each width after scrolling through the page (so scroll reveals have run),
and reports console errors and horizontal overflow. Used for the redesign at 320, 390, 768, 1024, 1440 and
1600 px; reduced motion and JavaScript-disabled rendering were checked by hand with Playwright.

## Not covered by automated tests

- A real Stripe Checkout round trip. The webhook handler is tested with correctly signed events, but the
  redirect to Stripe and back needs test keys and the Stripe CLI (see README).
- Password-reset emails: no email provider is configured; in development the link is printed to the console.
