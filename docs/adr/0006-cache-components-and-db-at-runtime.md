# ADR-0006 — Cache Components, and no database access at build time

**Status:** accepted · 2026-10-25

## Context

Next.js 16 with `cacheComponents` prerenders a static shell at build. If a page
reads the database during prerender, `next build` needs a live database — which
a Docker image build on CI does not have.

## Decision

- Catalog reads are `'use cache'` functions tagged (`cacheTag('catalog')`) with
  an explicit `cacheLife`. Admin mutations call `updateTag('catalog')`.
- Components that read the database call `await connection()` and sit inside
  `<Suspense>`, so the shell prerenders and data streams at request time.
- Per-user data (cart, account) is never cached across users.

## Consequence

`next build` succeeds without a database; the first request after a deploy or
an admin edit fills the cache.
