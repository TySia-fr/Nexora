"use client";

import { useActionState, useTransition } from "react";
import { applyCouponAction, removeCouponAction, type CouponState } from "@/server/actions/cart";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function CouponForm({ applied, message }: { applied: string | null; message: string | null }) {
  const [state, action, pending] = useActionState<CouponState, FormData>(applyCouponAction, null);
  const [removing, startRemove] = useTransition();

  if (applied) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-fg-muted">
            Code <span className="font-mono text-fg">{applied}</span>
          </span>
          <button
            type="button"
            disabled={removing}
            onClick={() => startRemove(async () => void (await removeCouponAction()))}
            className="h-11 text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Remove code
          </button>
        </div>
        <p role="status" className={cn("text-xs", message ? "text-warn" : "text-accent")}>
          {message ?? "Applied."}
        </p>
      </div>
    );
  }

  const error = state && !state.ok ? state.message : null;
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <label htmlFor="coupon" className="text-[13px] text-fg-muted">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="coupon"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          aria-invalid={Boolean(error)}
          aria-describedby="coupon-status"
          className={cn(inputClasses, "h-11 min-w-0 flex-1 bg-canvas font-mono text-sm uppercase")}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-input border border-line-strong px-4 text-sm hover:border-fg disabled:text-fg-subtle"
        >
          {pending ? "Checking…" : "Apply"}
        </button>
      </div>
      <p id="coupon-status" role="status" className="min-h-4 text-xs text-warn">
        {error}
      </p>
    </form>
  );
}
