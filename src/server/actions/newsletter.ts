"use server";

import { subscribe } from "@/server/newsletter";
import { enforceRateLimit } from "@/server/rate-limit";
import { toActionError, type ActionResult } from "@/server/errors";

export type NewsletterState = ActionResult | null;

export async function subscribeAction(_prev: NewsletterState, form: FormData): Promise<NewsletterState> {
  try {
    await enforceRateLimit("newsletter", 5, 60_000);
    await subscribe({ email: form.get("email") });
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
