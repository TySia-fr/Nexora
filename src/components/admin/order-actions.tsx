"use client";

import { useState, useTransition } from "react";
import { transitionOrderAction } from "@/server/actions/admin";
import { buttonClasses } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  PAID: "Mark paid",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
  REFUNDED: "Record refund",
};

const CONFIRM: Record<string, string> = {
  CANCELLED: "Cancel this unpaid order and return its items to stock?",
  REFUNDED:
    "Record this order as refunded? Issue the refund in the Stripe dashboard first — this does not move money.",
};

export function OrderActions({ orderId, allowed }: { orderId: string; allowed: string[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Admins never mark orders paid by hand: only the Stripe webhook does.
  const options = allowed.filter((s) => s !== "PAID");
  if (options.length === 0)
    return <p className="text-sm text-fg-subtle">No further status changes are possible.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => {
              if (CONFIRM[to] && !window.confirm(CONFIRM[to])) return;
              setError(null);
              start(async () => {
                const r = await transitionOrderAction(orderId, to);
                if (!r.ok) setError(r.message);
              });
            }}
            className={buttonClasses(to === "CANCELLED" || to === "REFUNDED" ? "secondary" : "inverse", "sm")}
          >
            {LABELS[to] ?? to}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
