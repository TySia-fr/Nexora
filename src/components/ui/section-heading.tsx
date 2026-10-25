import type { ReactNode } from "react";

export function SectionHeading({
  index,
  label,
  title,
  action,
  id,
}: {
  index: string;
  label: string;
  title?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-6">
      <div className="flex flex-col gap-2">
        <span className="label-mono text-fg-subtle">
          {index} / {label}
        </span>
        {title && (
          <h2 id={id} className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            {title}
          </h2>
        )}
      </div>
      {action}
    </div>
  );
}
