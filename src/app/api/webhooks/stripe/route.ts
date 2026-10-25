import { NextResponse } from "next/server";
import { handleStripeEvent, stripeGateway } from "@/server/payments";
import { paymentsEnabled } from "@/lib/env";

/**
 * Stripe webhook. The raw body is verified against the signing secret before
 * anything is parsed; unverified requests get 400 and change nothing.
 */
export async function POST(request: Request) {
  if (!paymentsEnabled) return NextResponse.json({ error: "payments disabled" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const body = await request.text();
  if (body.length > 512 * 1024) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  let event;
  try {
    event = stripeGateway.parseWebhook(body, signature);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // 500 makes Stripe retry; the event id was not recorded, so the retry is safe.
    console.error("[nexora] webhook processing failed", { id: event.id, type: event.type, err });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
