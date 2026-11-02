import type { ReactNode } from "react";
import type { StockLevel } from "@/lib/inventory";
import { cn } from "@/lib/cn";

const LEVEL: Record<StockLevel, { label: string; className: string }> = {
  out: { label: "Out of stock", className: "border-warn text-warn" },
  low: { label: "Low", className: "border-warn/60 text-warn" },
  ok: { label: "In stock", className: "border-line-strong text-fg-muted" },
  inactive: { label: "Inactive", className: "border-line text-fg-subtle" },
};

export function LevelBadge({ level }: { level: StockLevel }) {
  const l = LEVEL[level];
  return (
    <span
      className={cn(
        "label-mono inline-flex rounded-full border px-2 py-1 text-[10px] whitespace-nowrap",
        l.className,
      )}
    >
      {l.label}
    </span>
  );
}

/** A headline figure with an optional comparison to the previous period. */
export function Kpi({
  label,
  value,
  note,
  change,
  invert = false,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** Percentage change; null = no comparable previous value. */
  change?: number | null;
  /** For figures where lower is better. */
  invert?: boolean;
}) {
  const good = change === undefined || change === null ? null : invert ? change < 0 : change > 0;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5">
      <span className="label-mono text-fg-subtle">{label}</span>
      <span className="font-mono text-2xl tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        {change !== undefined && (
          <span
            className={cn(
              "font-mono tabular-nums",
              change === null ? "text-fg-subtle" : good ? "text-accent" : "text-warn",
            )}
            title="Change from the previous period of the same length"
          >
            {change === null ? "— vs prev." : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs prev.`}
          </span>
        )}
        {note}
      </span>
    </div>
  );
}

export function formatUnits(n: number): string {
  return new Intl.NumberFormat("en-IE").format(n);
}

export function formatPercent(ratio: number | null, digits = 1): string {
  return ratio === null ? "—" : `${(ratio * 100).toFixed(digits)}%`;
}

export function formatCover(days: number | null): string {
  if (days === null) return "—";
  if (days > 365) return "> 1 year";
  return `${days} d`;
}

/**
 * Bar chart drawn as SVG on the server: no chart library, no client JavaScript.
 * Every bar has a <title> for the exact value, and the figure has a text summary.
 */
export function BarChart({
  points,
  format,
  label,
}: {
  points: { key: string; label: string; value: number }[];
  format: (v: number) => string;
  label: string;
}) {
  const W = 720;
  const H = 180;
  const max = Math.max(1, ...points.map((p) => p.value));
  const gap = points.length > 60 ? 1 : 2;
  const bw = Math.max(1, (W - gap * (points.length - 1)) / points.length);
  const total = points.reduce((s, p) => s + p.value, 0);
  const best = points.reduce(
    (b, p) => (p.value > b.value ? p : b),
    points[0] ?? { key: "", label: "", value: 0 },
  );
  const tick = (i: number) => i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2);
  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-auto w-full" role="img" aria-label={label}>
        <line x1="0" x2={W} y1={H} y2={H} className="stroke-line-strong" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-line" strokeDasharray="2 4" />
        {points.map((p, i) => {
          const h = (p.value / max) * (H - 8);
          return (
            <g key={p.key}>
              <rect
                x={i * (bw + gap)}
                y={H - h}
                width={bw}
                height={Math.max(h, p.value > 0 ? 1 : 0)}
                className={p.value === best.value && p.value > 0 ? "fill-fg" : "fill-fg-subtle/70"}
              >
                <title>{`${p.label}: ${format(p.value)}`}</title>
              </rect>
              {tick(i) && (
                <text
                  x={Math.min(Math.max(i * (bw + gap) + bw / 2, 30), W - 30)}
                  y={H + 16}
                  textAnchor="middle"
                  className="fill-fg-subtle font-mono text-[10px]"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
        <text x={W} y={10} textAnchor="end" className="fill-fg-subtle font-mono text-[10px]">
          max {format(max)}
        </text>
      </svg>
      <figcaption className="text-xs text-fg-subtle">
        {label}: {format(total)} in total
        {best.value > 0 ? `, highest on ${best.label} (${format(best.value)})` : ", no sales in this period"}.
      </figcaption>
    </figure>
  );
}
