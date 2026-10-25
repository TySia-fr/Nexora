# ADR-0005 — better-auth with database sessions

**Status:** accepted · 2026-10-25

## Options
- Auth.js v5: still beta for the Next.js 16 line at time of writing.
- Rolling our own: unjustifiable risk for password storage and sessions.
- better-auth 1.7: stable, Prisma adapter, email + password, database-backed
  sessions that can be revoked.

## Decision
better-auth with email/password and database sessions (httpOnly, Secure in
production, SameSite=Lax cookie). The `role` column lives on `User`, is never
accepted from input, and is checked on the server for every admin page and
mutation (`requireAdmin()`), not by hiding links.

The first admin is created with `pnpm admin:create`, which reads the password
from an interactive prompt — never from a file or a seed.
