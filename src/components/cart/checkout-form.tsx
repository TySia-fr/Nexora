"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { startCheckoutAction, type CheckoutState } from "@/server/actions/checkout";
import { Field, Input } from "@/components/ui/field";
import { SummaryRows } from "@/components/cart/order-summary";
import { buttonClasses } from "@/components/ui/button";
import type { Totals } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

type Defaults = {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  phone: string;
};

export function CheckoutForm({
  defaults,
  totals,
  paymentsEnabled,
}: {
  defaults: Defaults;
  totals: { STANDARD: Totals; EXPRESS: Totals };
  paymentsEnabled: boolean;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckoutAction, null);
  const [method, setMethod] = useState<"STANDARD" | "EXPRESS">(
    state?.values?.shippingMethod === "EXPRESS" ? "EXPRESS" : "STANDARD",
  );
  const v = { ...defaults, ...state?.values };
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const err = (k: string) => fe[k] ?? fe[`address.${k}`];
  const formError = state && !state.ok && Object.keys(fe).length === 0 ? state.message : null;
  const t = totals[method];

  const field = (name: keyof Defaults, label: string, props: Record<string, unknown> = {}) => (
    <Field id={name} label={label} error={err(name)}>
      <Input
        id={name}
        name={name}
        defaultValue={v[name]}
        aria-invalid={Boolean(err(name))}
        aria-describedby={err(name) ? `${name}-error` : undefined}
        {...props}
      />
    </Field>
  );

  return (
    <form action={action} noValidate className="flex flex-wrap gap-14">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-10">
        {state && !state.ok && (
          <div role="alert" className="rounded-card border border-warn/60 p-4 text-sm text-warn">
            {formError ?? state.message}{" "}
            {(state.code === "CART_CHANGED" ||
              state.code === "OUT_OF_STOCK" ||
              state.code === "COUPON_REJECTED") && (
              <Link href="/cart" className="underline underline-offset-4">
                Review your cart
              </Link>
            )}
          </div>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="label-mono mb-4 text-fg-subtle">Contact</legend>
          {field("email", "Email", { type: "email", autoComplete: "email", required: true })}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="label-mono mb-4 text-fg-subtle">Shipping address · France</legend>
          <div className="sm:col-span-2">
            {field("fullName", "Full name", { autoComplete: "name", required: true })}
          </div>
          <div className="sm:col-span-2">
            {field("line1", "Address", { autoComplete: "address-line1", required: true })}
          </div>
          <div className="sm:col-span-2">
            {field("line2", "Apartment, building (optional)", { autoComplete: "address-line2" })}
          </div>
          {field("postalCode", "Postal code", {
            autoComplete: "postal-code",
            inputMode: "numeric",
            maxLength: 5,
            required: true,
          })}
          {field("city", "City", { autoComplete: "address-level2", required: true })}
          <div className="sm:col-span-2">
            {field("phone", "Phone (optional, for the carrier)", { type: "tel", autoComplete: "tel" })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="label-mono mb-4 text-fg-subtle">Delivery</legend>
          {(
            [
              ["STANDARD", "Standard", "2–4 business days"],
              ["EXPRESS", "Express", "Next business day"],
            ] as const
          ).map(([value, label, eta]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-card border p-4",
                method === value ? "border-fg" : "border-line-strong",
              )}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shippingMethod"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  className="size-4.5 accent-accent"
                />
                <span className="flex flex-col">
                  <span className="text-[15px]">{label}</span>
                  <span className="text-[13px] text-fg-subtle">{eta}</span>
                </span>
              </span>
              <span className="font-mono text-sm">
                {totals[value].shippingCents === 0 ? "Free" : formatMoney(totals[value].shippingCents)}
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <aside
        aria-label="Order summary"
        className="flex flex-[1_1_320px] flex-col gap-5 self-start rounded-card border border-line bg-surface p-7"
      >
        <h2 className="label-mono text-fg-subtle">Order summary</h2>
        <SummaryRows totals={t} />
        {paymentsEnabled ? (
          <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
            {pending ? "Reserving your items…" : `Pay ${formatMoney(t.totalCents)} securely`}
          </button>
        ) : (
          <>
            <button type="submit" disabled className={buttonClasses("primary", "lg", "w-full")}>
              Payments unavailable
            </button>
            <p role="note" className="text-[13px] text-warn">
              Payments aren&apos;t configured on this deployment, so orders can&apos;t be placed. Nothing is
              charged.
            </p>
          </>
        )}
        <p className="text-xs leading-relaxed text-fg-subtle">
          You&apos;ll pay on Stripe&apos;s secure page. Your order is confirmed only once Stripe confirms the
          payment. Items are reserved for 30 minutes.
        </p>
      </aside>
    </form>
  );
}
