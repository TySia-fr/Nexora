import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export function CartLink({ count }: { count: number | null }) {
  const label = count === null ? "Cart" : `Cart, ${count} ${count === 1 ? "item" : "items"}`;
  return (
    <Link
      href="/cart"
      aria-label={label}
      className="group ml-1 flex h-10 items-center gap-2 rounded-full bg-fg pr-3.5 pl-3 text-canvas transition-opacity duration-150 hover:opacity-85"
    >
      <ShoppingBag className="size-4" strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-[1ch] font-mono text-xs tabular-nums" aria-hidden="true">
        {count ?? "·"}
      </span>
      {count !== null && count > 0 && <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />}
    </Link>
  );
}
