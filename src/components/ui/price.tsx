import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Price({ cents, from, className }: { cents: number; from?: boolean; className?: string }) {
  return (
    <span className={cn("font-mono tracking-[0.02em] tabular-nums", className)}>
      {from && <span className="text-fg-subtle">From </span>}
      {formatMoney(cents)}
    </span>
  );
}
