# syntax=docker/dockerfile:1.7
# Multi-stage build: deps -> build -> slim runtime (Next.js standalone output).
# The build needs no database (ADR-0006).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
# next.config.ts decides at build time whether to send HSTS and
# upgrade-insecure-requests, so the public URL must be known here.
ARG APP_URL=http://localhost:3000
ENV APP_URL=$APP_URL
COPY . .
# Placeholder values only satisfy env validation at build time; real ones come at runtime.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret-000000" \
    pnpm exec prisma generate && \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret-000000" \
    pnpm build

# One-shot image for `prisma migrate deploy` and the seed.
FROM build AS migrate
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* && groupadd --system --gid 1001 nexora && useradd --system --uid 1001 --gid nexora nexora
WORKDIR /app
COPY --from=build --chown=nexora:nexora /app/.next/standalone ./
COPY --from=build --chown=nexora:nexora /app/.next/static ./.next/static
COPY --from=build --chown=nexora:nexora /app/public ./public
USER nexora
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
