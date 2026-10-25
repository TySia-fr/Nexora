import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { addToCart, getCart, type CartOwner } from "@/server/cart";
import { createOrderFromCart, getOrderByCheckoutSession } from "@/server/orders";
import { handleStripeEvent, startPayment, stripeGateway, type PaymentGateway } from "@/server/payments";
import { db, makeCategory, makeProduct, resetDatabase, validCheckout } from "./helpers";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const stripe = new Stripe("sk_test_offline");

/** A gateway that records sessions instead of calling Stripe. */
function fakeGateway(): PaymentGateway & { sessions: string[] } {
  const sessions: string[] = [];
  return {
    sessions,
    async createCheckoutSession(order) {
      const id = `cs_test_${order.id}`;
      sessions.push(id);
      return { sessionId: id, url: `https://checkout.stripe.test/${id}` };
    },
    parseWebhook: stripeGateway.parseWebhook,
  };
}

function signedEvent(event: object): { body: string; signature: string } {
  const body = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
  return { body, signature };
}

function sessionEvent(
  id: string,
  type: string,
  session: { id: string; orderId: string; cartId: string; amount: number; paymentStatus?: string },
) {
  return {
    id,
    object: "event",
    type,
    api_version: "2026-01-01",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        amount_total: session.amount,
        currency: "eur",
        payment_status: session.paymentStatus ?? "paid",
        payment_intent: "pi_test_123",
        client_reference_id: session.orderId,
        metadata: { orderId: session.orderId, cartId: session.cartId },
      },
    },
  };
}

async function deliver(event: object) {
  const { body, signature } = signedEvent(event);
  return handleStripeEvent(stripeGateway.parseWebhook(body, signature));
}

describe("payments", () => {
  let owner: CartOwner;
  let variantId: string;
  let productId: string;

  beforeEach(async () => {
    await resetDatabase();
    const category = await makeCategory("audio");
    const p = await makeProduct({ categoryId: category.id, variants: [{ priceCents: 34900, stock: 5 }] });
    variantId = p.variants[0]!.id;
    productId = p.id;
    owner = { guestToken: crypto.randomUUID() };
    await addToCart(owner, variantId, 2);
  });

  async function checkout() {
    const order = await createOrderFromCart(owner, validCheckout(), null);
    const gateway = fakeGateway();
    const session = await startPayment(order, gateway);
    return { order, session };
  }

  it("rejects webhooks with a bad signature", () => {
    const { body } = signedEvent({ id: "evt_1" });
    expect(() => stripeGateway.parseWebhook(body, "t=1,v1=deadbeef")).toThrow();
    const tampered = signedEvent({ id: "evt_2" });
    expect(() => stripeGateway.parseWebhook(tampered.body.replace("evt_2", "evt_3"), tampered.signature)).toThrow();
  });

  it("a browser reaching the success URL does not mark the order paid", async () => {
    const { session } = await checkout();
    const found = await getOrderByCheckoutSession(session.sessionId);
    expect(found?.status).toBe("PENDING_PAYMENT");
  });

  it("marks the order paid on a verified event, exactly once", async () => {
    const { order, session } = await checkout();
    const event = sessionEvent("evt_paid_1", "checkout.session.completed", {
      id: session.sessionId,
      orderId: order.id,
      cartId: order.cartId,
      amount: order.totalCents,
    });
    expect(await deliver(event)).toBe("processed");
    expect(await deliver(event)).toBe("duplicate");

    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(saved.status).toBe("PAID");
    expect(saved.paidAt).not.toBeNull();
    expect(saved.payments).toHaveLength(1);
    expect(saved.payments[0]).toMatchObject({ status: "SUCCEEDED", providerIntentId: "pi_test_123" });
    // Units sold counted once despite the redelivery; cart emptied.
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).unitsSold).toBe(2);
    expect((await getCart(owner)).lines).toHaveLength(0);
    // Stock stays reserved -> sold.
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(3);
  });

  it("does not mark paid when the amount doesn't match", async () => {
    const { order, session } = await checkout();
    await deliver(
      sessionEvent("evt_bad_amount", "checkout.session.completed", {
        id: session.sessionId,
        orderId: order.id,
        cartId: order.cartId,
        amount: 100,
      }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("waits for delayed payment methods", async () => {
    const { order, session } = await checkout();
    const base = { id: session.sessionId, orderId: order.id, cartId: order.cartId, amount: order.totalCents };
    await deliver(sessionEvent("evt_unpaid", "checkout.session.completed", { ...base, paymentStatus: "unpaid" }));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    await deliver(sessionEvent("evt_async_ok", "checkout.session.async_payment_succeeded", base));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it.each([
    ["checkout.session.async_payment_failed", "FAILED"],
    ["checkout.session.expired", "EXPIRED"],
  ])("%s cancels the order and returns the stock", async (type, paymentStatus) => {
    const { order, session } = await checkout();
    await deliver(
      sessionEvent(`evt_${type}`, type, {
        id: session.sessionId,
        orderId: order.id,
        cartId: order.cartId,
        amount: order.totalCents,
        paymentStatus: "unpaid",
      }),
    );
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(saved.status).toBe("CANCELLED");
    expect(saved.payments[0]!.status).toBe(paymentStatus);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5);
    // A late "paid" event can't resurrect a cancelled order.
    await deliver(
      sessionEvent(`evt_late_paid_${type}`, "checkout.session.completed", {
        id: session.sessionId,
        orderId: order.id,
        cartId: order.cartId,
        amount: order.totalCents,
      }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });

  it("releases the order if the payment provider is unreachable", async () => {
    const order = await createOrderFromCart(owner, validCheckout(), null);
    const broken: PaymentGateway = {
      createCheckoutSession: () => Promise.reject(new Error("ECONNRESET")),
      parseWebhook: stripeGateway.parseWebhook,
    };
    await expect(startPayment(order, broken)).rejects.toThrow(/payment provider/);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(5);
  });

  it("ignores unrelated event types", async () => {
    expect(await deliver({ id: "evt_other", object: "event", type: "customer.created", data: { object: {} } })).toBe("ignored");
  });
});
