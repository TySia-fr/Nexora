"use client";

import { useActionState, useTransition } from "react";
import { createCouponAction, setCouponActiveAction, type AdminFormState } from "@/server/actions/admin";
import { inputBase } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setCouponActiveAction(id, !active)))}
      className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
    >
      {active ? "Disable" : "Enable"}
    </button>
  );
}

export function CouponCreateForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createCouponAction, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const input = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`c-${name}`} className="label-mono text-fg-subtle">
        {label}
      </label>
      <input
        id={`c-${name}`}
        name={name}
        defaultValue={state && !state.ok ? state.values?.[name] : undefined}
        aria-invalid={Boolean(fe[name])}
        className={cn(inputBase, "h-10 w-full")}
        {...props}
      />
      {fe[name] && <span className="text-xs text-warn">{fe[name]}</span>}
    </div>
  );
  return (
    <form action={action} className="grid gap-3 rounded-card border border-line p-5 md:grid-cols-4">
      <h2 className="font-semibold md:col-span-4">New coupon</h2>
      {input("code", "Code", {
        placeholder: "SPRING10",
        className: cn(inputBase, "h-10 w-full font-mono uppercase"),
      })}
      <div className="flex flex-col gap-1">
        <label htmlFor="c-type" className="label-mono text-fg-subtle">
          Type
        </label>
        <select
          id="c-type"
          name="type"
          defaultValue={state && !state.ok ? state.values?.type : undefined}
          className={cn(inputBase, "h-10")}
        >
          <option value="PERCENT">Percent off</option>
          <option value="FIXED">Fixed amount (€)</option>
        </select>
      </div>
      {input("value", "Value (% or €)", { inputMode: "decimal" })}
      {input("minSubtotal", "Minimum order €", { inputMode: "decimal", placeholder: "0" })}
      <div className="flex flex-col gap-1">
        <label htmlFor="c-category" className="label-mono text-fg-subtle">
          Only category
        </label>
        <select
          id="c-category"
          name="categoryId"
          defaultValue={state && !state.ok ? state.values?.categoryId : undefined}
          className={cn(inputBase, "h-10")}
        >
          <option value="">Whole catalog</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {input("startsAt", "Starts", { type: "datetime-local" })}
      {input("endsAt", "Ends", { type: "datetime-local" })}
      {input("maxRedemptions", "Max uses", { inputMode: "numeric", placeholder: "Unlimited" })}
      <div className="flex items-center gap-4 md:col-span-4">
        <button type="submit" disabled={pending} className={buttonClasses("inverse", "sm", "rounded-input")}>
          Create coupon
        </button>
        <p role="status" className="text-sm">
          {state?.ok && <span className="text-accent">Coupon created.</span>}
          {state && !state.ok && !state.fieldErrors && <span className="text-warn">{state.message}</span>}
        </p>
      </div>
    </form>
  );
}
