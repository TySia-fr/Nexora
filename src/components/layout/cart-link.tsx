import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export function CartLink({ count }: { count: number | null }) {
  const label = count === null ? "Cart" : `Cart, ${count} ${count === 1 ? "item" : "items"}`;
  return (
    <Link
      href="/cart"
      aria-label={label}
      className="ml-1 flex h-11 items-center gap-2 rounded-full border border-line-strong px-3 hover:border-paper"
    >
      <ShoppingBag className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
      <span className="font-mono text-xs tabular-nums" aria-hidden="true">
        {count ?? "·"}
      </span>
    </Link>
  );
}
