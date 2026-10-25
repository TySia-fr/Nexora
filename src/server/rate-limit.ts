import "server-only";
import { headers } from "next/headers";
import { AppError } from "@/server/errors";

/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Enough for a single container behind Nginx (this deployment). With several
 * app instances, limits would be per instance; move the counters to Redis or
 * Postgres at that point. Nginx `limit_req` sits in front as the first line.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

/** Client IP as seen by the reverse proxy. Only trust X-Forwarded-For behind a proxy you control. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function enforceRateLimit(action: string, limit: number, windowMs: number): Promise<void> {
  const ip = await clientIp();
  if (!hit(`${action}:${ip}`, limit, windowMs)) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
  }
}
