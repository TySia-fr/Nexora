import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/server/mailer";

/**
 * Email + password auth with database sessions (ADR-0005).
 * `role` is a server-only field: `input: false` means sign-up and profile
 * updates can never set it, whatever the request body contains.
 */
export const auth = betterAuth({
  appName: "NEXORA",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Reset your NEXORA password",
        text: `Someone asked to reset the password for this account.\n\nIf it was you, open this link within 30 minutes:\n${url}\n\nIf it wasn't, ignore this email; your password stays the same.`,
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, input: false, defaultValue: "CUSTOMER" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh expiry at most daily
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: "nx",
  },
  // Must stay last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
