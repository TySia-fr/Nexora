# ADR-0007 — Generating migrations from a restricted environment

**Status:** accepted · 2026-10-25

## Context
Part of this project was built in a sandbox that cannot download the Prisma
migration engine binary.

## Decision
- `.github/workflows/migration-draft.yml` (manual trigger) runs
  `prisma migrate dev --create-only` on CI and pushes the result to the
  `migration-draft` branch for review before it is copied to `main`.
- CI on every push runs `prisma migrate deploy` and then
  `prisma migrate diff --exit-code` against the schema, so a migration that
  does not match `schema.prisma` fails the build.
- On a normal machine, use `pnpm db:migrate`.
