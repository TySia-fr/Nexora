import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at startup.
 *
 * Payments are optional in development: without Stripe keys the store runs in
 * "disabled" payments mode and checkout says so explicitly instead of faking a
 * successful payment.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url(),
    APP_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  })
  .refine((e) => Boolean(e.STRIPE_SECRET_KEY) === Boolean(e.STRIPE_WEBHOOK_SECRET), {
    message: "Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither.",
  })
  // NEXORA is a demo store: refuse live keys so a misconfigured deploy can
  // never charge a real card.
  .refine((e) => !e.STRIPE_SECRET_KEY?.startsWith("sk_live_"), {
    message: "Live Stripe keys are not allowed; use test-mode keys (sk_test_...).",
    path: ["STRIPE_SECRET_KEY"],
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Print which variables are wrong, never their values.
    const problems = parsed.error.issues.map((i) => `- ${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  return parsed.data;
}

export const env = load();

export const paymentsEnabled = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
