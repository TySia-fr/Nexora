import "server-only";
import Stripe from "stripe";
import { db } from "@/server/db";
import { env, paymentsEnabled } from "@/lib/env";
import { AppError } from "@/server/errors";
import {
  cancelPendingOrder,
  formatOrderNumber,
  markOrderPaid,
  RESERVATION_MINUTES,
  type CreatedOrder,
} from "@/server/orders";

/**
 * Payment boundary. The rest of the app talks to `PaymentGateway`, so tests
 * can swap in a fake without network calls. Only the webhook handler can mark
 * an order paid (ADR-0004).
 */
export type CheckoutSessionResult = { sessionId: string; url: string };

export interface PaymentGateway {
  createCheckoutSession(order: CreatedOrder): Promise<CheckoutSessionResult>;
  parseWebhook(rawBody: string, signature: string): Stripe.Event;
}

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new AppError("PAYMENTS_DISABLED", "Payments are not configured.");
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15_000 });
  return stripeClient;
}

export const stripeGateway: PaymentGateway = {
  async createCheckoutSession(order) {
    const s = stripe();
    // Discounts are applied with a single-use coupon for the exact amount our
    // server computed, so Stripe's total always equals order.totalCents.
    const discounts = order.discountCents > 0
      ? [
          {
            coupon: (
              await s.coupons.create(
                {
                  amount_off: order.discountCents,
                  currency: "eur",
                  duration: "once",
                  max_redemptions: 1,
                  name: order.couponCode ?? "Discount",
                },
                { idempotencyKey: `coupon-${order.id}` },
              )
            ).id,
          },
        ]
      : undefined;

    const session = await s.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: order.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id, cartId: order.cartId },
        payment_intent_data: { metadata: { orderId: order.id } },
        line_items: order.items.map((i) => ({
          quantity: i.quantity,
          price_data: {
            currency: "eur",
            unit_amount: i.unitPriceCents,
            product_data: { name: `${i.productName} — ${i.variantName}` },
          },
        })),
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: order.shippingCents === 0 ? "Free shipping" : "Shipping",
              fixed_amount: { amount: order.shippingCents, currency: "eur" },
            },
          },
        ],
        discounts,
        expires_at: Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60,
        success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.APP_URL}/cart?checkout=cancelled`,
      },
      { idempotencyKey: `checkout-${order.id}` },
    );
    if (!session.url) throw new Error("Stripe returned a session without a URL");
    return { sessionId: session.id, url: session.url };
  },

  parseWebhook(rawBody, signature) {
    if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError("PAYMENTS_DISABLED", "Payments are not configured.");
    return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  },
};

/**
 * Creates the Stripe session for a freshly created order and records a PENDING
 * payment. If Stripe fails, the order is cancelled so its stock is released.
 */
export async function startPayment(
  order: CreatedOrder,
  gateway: PaymentGateway = stripeGateway,
): Promise<CheckoutSessionResult> {
  if (gateway === stripeGateway && !paymentsEnabled) {
    await db.$transaction((tx) => cancelPendingOrder(tx, order.id, null));
    throw new AppError(
      "PAYMENTS_DISABLED",
      "Payments are not configured on this demo deployment, so orders can't be completed.",
    );
  }
  try {
    const session = await gateway.createCheckoutSession(order);
    await db.payment.create({
      data: {
        orderId: order.id,
        providerSessionId: session.sessionId,
        amountCents: order.totalCents,
        status: "PENDING",
      },
    });
    return session;
  } catch (err) {
    console.error(`[nexora] could not start payment for ${formatOrderNumber(order.number)}`, err);
    await db.$transaction((tx) => cancelPendingOrder(tx, order.id, "FAILED"));
    if (err instanceof AppError) throw err;
    throw new AppError("CONFLICT", "We couldn't reach the payment provider. Your cart is unchanged — please try again.");
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

/**
 * Applies a verified Stripe event exactly once. The event id is inserted in
 * the same transaction as its effects; a redelivery hits the primary key and
 * changes nothing.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  if (!HANDLED.has(event.type)) return "ignored";
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) {
    console.warn("[nexora] checkout event without order id", event.id);
    return "ignored";
  }

  return db.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO "ProcessedWebhookEvent" ("id", "type") VALUES (${event.id}, ${event.type})
      ON CONFLICT ("id") DO NOTHING
    `;
    if (inserted === 0) return "duplicate";

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        // For delayed methods "completed" arrives with payment_status "unpaid";
        // the order stays pending until async_payment_succeeded.
        if (session.payment_status !== "paid") return "processed";
        const ok = await markOrderPaid(
          tx,
          orderId,
          {
            sessionId: session.id,
            intentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
            amountCents: session.amount_total ?? -1,
            currency: session.currency ?? "",
          },
          session.metadata?.cartId ?? null,
        );
        if (!ok) console.warn("[nexora] paid event did not change order", { orderId, event: event.id });
        return "processed";
      }
      case "checkout.session.async_payment_failed":
        await cancelPendingOrder(tx, orderId, "FAILED");
        return "processed";
      case "checkout.session.expired":
        await cancelPendingOrder(tx, orderId, "EXPIRED");
        return "processed";
      default:
        return "ignored";
    }
  });
}
