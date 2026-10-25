import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Input styling without a width, for selects and inline controls. */
export const inputBase =
  "h-12 rounded-input border border-line bg-surface px-3.5 text-[15px] text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none aria-[invalid=true]:border-warn";
export const inputClasses = `${inputBase} w-full`;

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] text-fg-muted">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClasses, className)} {...props} />;
}
