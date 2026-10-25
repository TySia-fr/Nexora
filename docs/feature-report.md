# Feature completeness report

Status as of 2026-10-25. "Done" means implemented **and** covered by a test or a recorded manual check;
anything less is marked.

## Acceptance criteria

| Criterion                                           | Status              | Evidence                                                                      |
| --------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Homepage and all required routes exist              | Done                | 31 routes in the build output; e2e navigation                                 |
| Product and category data come from the database    | Done                | `src/server/catalog.ts`; seed; e2e                                            |
| Search, filters, sorting and variants work          | Done                | `tests/integration/catalog.test.ts`; e2e storefront                           |
| Cart totals calculated and validated on the server  | Done                | `pricing.test.ts`, `cart-and-orders.test.ts`                                  |
| Authentication and authorization enforced           | Done                | `admin.test.ts`, `account.test.ts`; e2e accounts/admin                        |
| Orders persisted correctly                          | Done                | snapshot and concurrency tests; DB CHECK constraints                          |
| Payment status verified via the payment integration | Done, with a caveat | signed-webhook tests; a real Stripe round trip needs test keys (not run here) |
| Admin operations work and are protected             | Done                | `admin.test.ts`; e2e admin                                                    |
| Responsive layouts checked                          | Done                | e2e on a Pixel 7 viewport; screenshots in `docs/screenshots`                  |
| No broken links or dead primary actions             | Done                | every button is wired; payments-off state is explicit, not dead               |
| Type checking and linting pass                      | Done                | CI `verify` job                                                               |
| Relevant tests pass                                 | Done                | 79 unit/integration + 20 e2e, green in CI                                     |
| Setup and deployment documentation                  | Done                | README, `docs/deployment.md`, `docs/testing.md`                               |
| External dependencies and limitations documented    | Done                | this file, `docs/security.md`                                                 |

## Routes

Storefront: `/`, `/products`, `/categories/[slug]`, `/products/[slug]`, `/search`, `/cart`, `/checkout`,
`/checkout/success`, `/about`, `/contact`, `/shipping`, `/returns`, `/privacy`, `/terms`.
Auth: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`.
Account: `/account`, `/account/orders`, `/account/orders/[id]`, `/account/addresses`, `/account/wishlist`.
Admin: `/admin`, `/admin/orders`, `/admin/orders/[id]`, `/admin/products`, `/admin/products/new`,
`/admin/products/[id]`, `/admin/categories`, `/admin/coupons`, `/admin/reviews`, `/admin/customers`.
API: `/api/auth/*`, `/api/webhooks/stripe`, `/api/health`, plus `sitemap.xml` and `robots.txt`.

## Integrations that need credentials

| Integration                          | Without credentials                                                                                    | To enable                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Stripe (test mode)                   | Checkout shows "Payments unavailable"; nothing is faked                                                | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, webhook endpoint (see deployment guide) |
| Email (password reset, order emails) | Development: reset link printed to the console. Production: the reset page says email isn't configured | Implement `deliver` in `src/server/mailer.ts` with a provider such as Resend          |

## Known limitations

- **Product imagery is generated vector art**, consistent and original but not photography. A premium launch
  needs real renders or licensed photos; the image pipeline (`next/image`, AVIF/WebP, sizes) is ready for them.
- **Soft 404s on dynamic pages.** Pages stream; when a product or category doesn't exist, the not-found page is
  rendered with `noindex` but the status stays 200. Unmatched paths return a real 404.
- **Metadata of dynamic pages is streamed** into the body for most user agents (Next.js behaviour), which
  Lighthouse flags on product pages (SEO 92). Crawlers that need it in `<head>` get it there.
- **Variant picker is a single list** of combined options ("256 GB · Bone"), not separate colour and storage
  selectors.
- **No image upload in admin**, no email verification, no 2FA, no order emails.
- **Refunds are recorded, not executed** through the Stripe API.
- **Rate limiting is per process** (fine for one container).
- Policy pages are demo text, marked for business review.

## Production-readiness tasks

1. Email provider + email verification + order confirmation emails.
2. Real product photography and an upload flow with validation.
3. Stripe refunds via API from the admin order page.
4. Shared rate-limit store if more than one app instance runs.
5. Structured logging and error monitoring.
6. Nonce-based CSP if the trade-off against caching becomes acceptable.
7. Independent security review.
