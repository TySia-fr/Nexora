import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

export function AdminHeader({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {meta && <span className="label-mono text-fg-subtle">{meta}</span>}
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  href,
}: {
  page: number;
  pageCount: number;
  href: (p: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses("secondary", "sm")}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="label-mono text-fg-subtle">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={buttonClasses("secondary", "sm")}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function TableBox({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-card border border-line">{children}</div>;
}

export const th = "label-mono p-3.5 text-left font-normal text-fg-subtle";
export const td = "border-t border-line p-3.5 align-top";

export function pageParam(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

export function strParam(v: unknown, max = 80): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined;
}
