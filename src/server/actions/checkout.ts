"use server";

import { redirect } from "next/navigation";
import { createOrderFromCart } from "@/server/orders";
import { startPayment } from "@/server/payments";
import { getCartOwner, getViewer } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { AppError, toActionError, type ActionResult } from "@/server/errors";

export type CheckoutState = (ActionResult & { values?: Record<string, string> }) | null;

const FIELDS = [
  "email",
  "fullName",
  "line1",
  "line2",
  "postalCode",
  "city",
  "phone",
  "shippingMethod",
] as const;

export async function startCheckoutAction(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? "")]));
  let url: string;
  try {
    await enforceRateLimit("checkout", 10, 60_000);
    const owner = await getCartOwner();
    if (!owner) throw new AppError("CART_EMPTY", "Your cart is empty.");
    const viewer = await getViewer();
    // Only these fields are read from the form; prices, totals and items come
    // from the database inside createOrderFromCart.
    const order = await createOrderFromCart(
      owner,
      {
        email: values.email,
        shippingMethod: values.shippingMethod,
        address: {
          fullName: values.fullName,
          line1: values.line1,
          line2: values.line2,
          postalCode: values.postalCode,
          city: values.city,
          country: "FR",
          phone: values.phone,
        },
      },
      viewer?.id ?? null,
    );
    url = (await startPayment(order)).url;
  } catch (e) {
    return { ...toActionError(e), values };
  }
  // Outside try: redirect() works by throwing.
  redirect(url);
}
