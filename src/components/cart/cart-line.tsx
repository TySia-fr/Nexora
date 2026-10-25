"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CartLineView } from "@/server/cart";
import { removeLineAction, setQuantityAction } from "@/server/actions/cart";
import { Price } from "@/components/ui/price";
import { inputBase } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const ISSUE_TEXT = {
  unavailable: "No longer available. Remove it to continue.",
  out_of_stock: "Out of stock. Remove it to continue.",
  insufficient_stock: "",
} as const;

export function CartLine({ line }: { line: CartLineView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const issue =
    line.issue === "insufficient_stock"
      ? `Only ${line.available} left. Lower the quantity to continue.`
      : line.issue
        ? ISSUE_TEXT[line.issue]
        : null;
  const options = Array.from({ length: Math.max(line.maxQuantity, line.quantity) }, (_, i) => i + 1);

  return (
    <li
      className={cn(
        "grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-b border-line py-6 sm:grid-cols-[112px_minmax(0,1fr)_auto]",
        pending && "opacity-60",
      )}
    >
      <Link
        href={`/products/${line.productSlug}`}
        className="relative aspect-square overflow-hidden rounded-input bg-well"
      >
        {line.image && (
          <Image src={line.image.url} alt={line.image.alt} fill sizes="112px" className="object-cover" />
        )}
      </Link>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link href={`/products/${line.productSlug}`} className="font-medium hover:text-accent">
          {line.productName}
        </Link>
        <span className="text-[13px] text-fg-subtle">
          {line.variantName} · <span className="font-mono">{line.sku}</span>
        </span>
        <Price cents={line.unitPriceCents} className="text-sm text-fg-muted" />
        {issue && <p className="text-[13px] text-warn">{issue}</p>}
        {error && (
          <p role="alert" className="text-[13px] text-warn">
            {error}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          {line.issue !== "unavailable" && line.issue !== "out_of_stock" && (
            <>
              <label htmlFor={`qty-${line.id}`} className="sr-only">
                Quantity for {line.productName}, {line.variantName}
              </label>
              <select
                id={`qty-${line.id}`}
                value={line.quantity}
                disabled={pending}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  setError(null);
                  startTransition(async () => {
                    const r = await setQuantityAction(line.id, q);
                    if (!r.ok) setError(r.message);
                  });
                }}
                className={cn(inputBase, "h-11 w-20")}
              >
                {options.map((n) => (
                  <option key={n} value={n} disabled={n > line.available}>
                    {n}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await removeLineAction(line.id);
                if (!r.ok) setError(r.message);
              })
            }
            className="h-11 px-1 text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Remove<span className="sr-only"> {line.productName}</span>
          </button>
        </div>
      </div>
      <Price cents={line.lineTotalCents} className="col-start-2 text-[15px] sm:col-start-3 sm:text-right" />
    </li>
  );
}
