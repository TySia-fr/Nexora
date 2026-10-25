import { cn } from "@/lib/cn";

/**
 * The NEXORA mark: an N whose diagonal is crossed at its centre by a short
 * counter-stroke, so the X sits inside the N. Drawn on a 24-unit grid with square caps.
 */
export function LogoMark({ className, draw = false }: { className?: string; draw?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn("shrink-0", draw && "logo-draw", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path className="logo-n" pathLength="1" d="M4.5 19.5V4.5L19.5 19.5V4.5" />
      <path className="logo-x" pathLength="1" d="M15 9L9 15" />
    </svg>
  );
}

/** Wordmark set in live text, so it stays sharp, selectable and readable by assistive tech. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[15px] leading-none font-semibold tracking-[0.2em] [font-stretch:125%]",
        className,
      )}
    >
      NEXORA
    </span>
  );
}
