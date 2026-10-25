# Security

This lists the controls that exist in the code, where they live, and what is still missing. Adding controls is
not the same as being production-secure; the gaps at the end are real.

## Controls in place

| Threat                      | Control                                                                                                                                    | Where                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Price or discount tampering | Totals computed from database prices on every request; the only checkout inputs read are email, address and delivery method                | `src/lib/pricing.ts`, `src/server/orders.ts`                   |
| Overselling                 | Conditional stock decrement in the order transaction; `CHECK (stock >= 0)`                                                                 | `orders.ts`, `*_integrity_checks` migration                    |
| Fake "paid" orders          | Only the signature-verified webhook marks paid; amount and currency must match; manual "paid" refused                                      | `payments.ts`, `orders.ts`                                     |
| Webhook replay              | Event id stored in the same transaction as its effects                                                                                     | `ProcessedWebhookEvent`                                        |
| IDOR                        | Every customer query filters by the session user id or cart owner                                                                          | `cart.ts`, `orders.ts`, `account.ts`                           |
| Privilege escalation        | `role` is `input: false` in better-auth and re-read from the database on each check; admin role checked in every page and every action     | `auth.ts`, `session.ts`, `admin-guard.tsx`, `actions/admin.ts` |
| Mass assignment             | Zod schemas pick fields explicitly; ids like `userId` come from the session                                                                | `src/lib/validation/*`                                         |
| SQL injection               | Prisma queries and tagged `$queryRaw`; LIKE wildcards escaped                                                                              | `catalog.ts`                                                   |
| Account enumeration         | Same message for unknown email and wrong password; same response for password-reset requests and newsletter sign-ups                       | `actions/auth.ts`, `newsletter.ts`                             |
| Brute force                 | Per-IP rate limits on sign-in, sign-up, reset, coupons, checkout, cart, newsletter; better-auth's own limits on its HTTP endpoints         | `rate-limit.ts`, `auth.ts`                                     |
| Open redirect               | `?next=` must be a same-site path                                                                                                          | `safeRedirectPath`                                             |
| CSRF                        | Server Actions only accept same-origin POSTs (Next.js checks Origin); session cookie is `SameSite=Lax`, `HttpOnly`, `Secure` in production | Next.js, `auth.ts`                                             |
| XSS                         | React escaping; raw HTML only for JSON-LD (`<` escaped) and one constant inline head script with no input; CSP                             | `products/[slug]/page.tsx`, `layout.tsx`, `next.config.ts`     |
| Clickjacking                | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                                                                          | `next.config.ts`                                               |
| Information leakage         | Unknown errors logged server-side, users see a generic message and a digest                                                                | `errors.ts`, `error.tsx`                                       |
| Secrets                     | Validated at startup, never printed; `.env*` ignored; live Stripe keys refused                                                             | `env.ts`, `.gitignore`                                         |
| Container                   | Non-root user, read-only root filesystem, `no-new-privileges`, app bound to 127.0.0.1                                                      | `Dockerfile`, `compose.yaml`                                   |
| Supply chain                | Lockfile, CI actions pinned by commit SHA                                                                                                  | `.github/workflows`                                            |

## Known gaps before a real launch

1. **CSP uses `'unsafe-inline'` for scripts.** Nonce-based CSP would make every page dynamic; the risk is
   reduced (no user HTML, no third-party scripts) but not removed.
2. **Rate limits are in process memory.** Correct for one container; with several instances they need Redis
   or Postgres. Nginx `limit_req` should sit in front either way.
3. **No email verification or 2FA**, and no email provider, so password reset can't work in production yet.
4. **No image uploads** — so no upload validation either. Adding uploads means type sniffing, size limits and
   storage outside the web root.
5. **Refunds are recorded, not executed.** An admin must refund in Stripe first.
6. **No independent review or penetration test.** This document is the author's own assessment.
7. **Logs are console output.** Production needs structured logs, retention rules and alerting.
