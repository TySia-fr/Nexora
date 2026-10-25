"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { inputBase } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Changing the sort updates the URL (and resets to page 1). */
export function SortSelect({ value, labels }: { value: string; labels: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="label-mono text-fg-subtle">
        Sort
      </label>
      <select
        id="sort"
        value={value}
        aria-busy={pending}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value === "newest") next.delete("sort");
          else next.set("sort", e.target.value);
          next.delete("page");
          const qs = next.toString();
          startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
        }}
        className={cn(inputBase, "h-11 pr-8")}
      >
        {Object.entries(labels).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
