import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * primary   — solid foreground colour (near-black on light, off-white inside .theme-dark)
 * secondary — hairline outline
 * ghost     — text only
 * inverse   — solid, quieter weight; kept for compact form actions
 * signal    — the brand accent; one per screen at most
 */
type Variant = "primary" | "secondary" | "ghost" | "inverse" | "signal";
type Size = "md" | "lg" | "sm";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-canvas hover:bg-fg/85",
  secondary: "border border-line-strong text-fg hover:border-fg hover:bg-fg/[0.03]",
  ghost: "text-fg hover:text-fg-muted",
  inverse: "bg-fg text-canvas hover:bg-fg/85",
  signal: "bg-signal text-on-signal hover:bg-signal-strong",
};
const sizes: Record<Size, string> = {
  sm: "h-11 px-4 text-sm",
  md: "h-12 px-6 text-[15px]",
  lg: "h-14 px-7 text-[15px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

/** Arrow that nudges forward on hover; purely decorative. */
export function ButtonArrow() {
  return (
    <ArrowRight
      className="size-4 transition-transform duration-[var(--duration-ui)] ease-[var(--ease-out-expo)] group-hover/btn:translate-x-0.5"
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}

type Extra = { variant?: Variant; size?: Size; arrow?: boolean; children?: ReactNode };

export function Button({
  variant,
  size,
  arrow,
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & Extra) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...props}>
      {children}
      {arrow && <ButtonArrow />}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & Extra) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
      {arrow && <ButtonArrow />}
    </Link>
  );
}
