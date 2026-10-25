import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * One PrismaClient per process. In development, Next.js hot reload re-evaluates
 * modules, so the instance is parked on globalThis to avoid exhausting
 * Postgres connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
/** Client usable inside `db.$transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
