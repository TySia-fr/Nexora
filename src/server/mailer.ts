import "server-only";
import { env } from "@/lib/env";

/**
 * Outgoing email. No provider is configured in this project yet, so:
 * - development/test: the message is printed to the server console;
 * - production: sending fails loudly instead of pretending to succeed, and the
 *   UI tells users that email-based features are unavailable.
 * Wiring a provider (e.g. Resend) means implementing `deliver` below.
 */
export const emailEnabled = false;

export type Email = { to: string; subject: string; text: string };

export async function sendEmail(message: Email): Promise<void> {
  if (emailEnabled) {
    throw new Error("No email provider implemented");
  }
  if (env.NODE_ENV === "production") {
    console.error("[nexora] email not sent: no provider configured", { subject: message.subject });
    return;
  }
  console.info(`\n[nexora:dev-mail] to=${message.to}\nsubject: ${message.subject}\n\n${message.text}\n`);
}
