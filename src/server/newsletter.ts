import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export const newsletterSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254),
});

/**
 * Subscribes an address. The response is identical whether or not the address
 * was already subscribed, so the form can't be used to probe who is a customer.
 */
export async function subscribe(raw: unknown): Promise<void> {
  const parsed = newsletterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Enter a valid email address.");
  }
  await db.newsletterSubscription.upsert({
    where: { email: parsed.data.email },
    create: { email: parsed.data.email, unsubscribeToken: randomBytes(24).toString("base64url") },
    update: { unsubscribedAt: null },
  });
}

export async function unsubscribe(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return false;
  const { count } = await db.newsletterSubscription.updateMany({
    where: { unsubscribeToken: token, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });
  return count > 0;
}
