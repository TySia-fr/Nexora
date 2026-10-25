import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Section header: a hairline with a tick, a numbered mono label and an editorial title.
 * The number is the section's position on the page, so the sequence reads as an index.
 */
export function SectionHeading({
  index,
  label,
  title,
  action,
  id,
  intro,
  className,
}: {
  index: string;
  label: string;
  title?: ReactNode;
  action?: ReactNode;
  id?: string;
  intro?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rule-tick mb-10 grid gap-6 pt-6 md:mb-14 md:grid-cols-12 md:gap-8", className)}
      data-reveal
    >
      <span className="label-mono text-fg-subtle md:col-span-3">
        {index} <span className="text-line-strong">/</span> {label}
      </span>
      <div className="flex flex-col gap-4 md:col-span-6">
        {title && (
          <h2 id={id} className="text-display-m">
            {title}
          </h2>
        )}
        {intro && <p className="max-w-xl text-[15px] leading-relaxed text-fg-muted">{intro}</p>}
      </div>
      {action && <div className="flex items-end md:col-span-3 md:justify-end">{action}</div>}
    </div>
  );
}

/** Text link with a moving arrow, for section-level "view all" actions. */
export function ArrowLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("group/al inline-flex items-center gap-2 text-sm font-medium", className)}>
      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 ease-[var(--ease-out-expo)] group-hover/al:bg-[length:100%_1px]">
        {children}
      </span>
      <svg
        viewBox="0 0 16 16"
        className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/al:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M2 8h11M9 4l4 4-4 4" />
      </svg>
    </span>
  );
}
