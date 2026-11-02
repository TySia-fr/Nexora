"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition } from "react";
import {
  adjustStockAction,
  cancelCountAction,
  commitCountAction,
  openCountAction,
  recordCountsAction,
  refreshStaleLinesAction,
  updateVariantSettingsAction,
  type InventoryFormState,
} from "@/server/actions/inventory";
import { Field, inputClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function FormStatus({ state, success }: { state: InventoryFormState; success: string }) {
  return (
    <p role="status" className={cn("min-h-5 text-[13px]", state && !state.ok ? "text-warn" : "text-accent")}>
      {state ? (state.ok ? success : state.message) : ""}
    </p>
  );
}

const REASONS = [
  { value: "RECEIVED", label: "Goods received", help: "Adds units from a supplier delivery." },
  { value: "RETURNED", label: "Customer return", help: "Adds a returned unit back to sellable stock." },
  { value: "DAMAGED", label: "Damaged / lost", help: "Removes units that can't be sold." },
  {
    value: "ADJUSTMENT",
    label: "Correction",
    help: "Adds or removes units (use − to remove). Needs a note.",
  },
] as const;

export function AdjustStockForm({ variantId }: { variantId: string }) {
  const [state, action, pending] = useActionState<InventoryFormState, FormData>(adjustStockAction, null);
  const [reason, setReason] = useState<string>(state?.values?.reason ?? "RECEIVED");
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const help = REASONS.find((r) => r.value === reason)?.help;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="variantId" value={variantId} />
      <Field label="Reason" id="reason" error={errors?.reason} hint={help}>
        <select
          id="reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClasses}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Units" id="quantity" error={errors?.quantity}>
        <input
          id="quantity"
          name="quantity"
          inputMode="numeric"
          required
          // React resets uncontrolled fields after the action; on an error the
          // submitted values come back as defaults.
          aria-invalid={Boolean(errors?.quantity)}
          aria-describedby={errors?.quantity ? "quantity-error" : undefined}
          defaultValue={state && !state.ok ? state.values?.quantity : ""}
          placeholder={reason === "ADJUSTMENT" ? "e.g. -2 or 3" : "e.g. 12"}
          className={cn(inputClasses, "font-mono")}
        />
      </Field>
      <Field
        label="Note"
        id="note"
        error={errors?.note}
        hint="Supplier reference, order number, what happened…"
      >
        <input
          id="note"
          name="note"
          maxLength={200}
          aria-invalid={Boolean(errors?.note)}
          aria-describedby={errors?.note ? "note-error" : "note-hint"}
          defaultValue={state && !state.ok ? state.values?.note : ""}
          className={inputClasses}
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("inverse", "md", "self-start rounded-input")}
      >
        {pending ? "Recording…" : "Record movement"}
      </button>
      <FormStatus state={state} success="Movement recorded." />
    </form>
  );
}

export function VariantSettingsForm({
  variantId,
  reorderPoint,
  costCents,
}: {
  variantId: string;
  reorderPoint: number;
  costCents: number | null;
}) {
  const [state, action, pending] = useActionState<InventoryFormState, FormData>(
    updateVariantSettingsAction,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="variantId" value={variantId} />
      <Field
        label="Reorder point"
        id="reorderPoint"
        error={errors?.reorderPoint}
        hint="Flagged as low at or below this many available units."
      >
        <input
          id="reorderPoint"
          name="reorderPoint"
          inputMode="numeric"
          aria-invalid={Boolean(errors?.reorderPoint)}
          aria-describedby={errors?.reorderPoint ? "reorderPoint-error" : "reorderPoint-hint"}
          defaultValue={state?.values?.reorderPoint ?? String(reorderPoint)}
          className={cn(inputClasses, "font-mono")}
        />
      </Field>
      <Field
        label="Unit cost (€, ex. VAT)"
        id="cost"
        error={errors?.costCents}
        hint="Used for stock value and for margins on future sales. Leave empty if unknown."
      >
        <input
          id="cost"
          name="cost"
          inputMode="decimal"
          aria-invalid={Boolean(errors?.costCents)}
          aria-describedby={errors?.costCents ? "cost-error" : "cost-hint"}
          defaultValue={state?.values?.costCents ?? (costCents === null ? "" : (costCents / 100).toFixed(2))}
          className={cn(inputClasses, "font-mono")}
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("secondary", "md", "self-start rounded-input")}
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
      <FormStatus state={state} success="Settings saved." />
    </form>
  );
}

export function OpenCountForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<InventoryFormState, FormData>(openCountAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Scope" id="categoryId">
        <select id="categoryId" name="categoryId" className={cn(inputClasses, "h-11 w-56")}>
          <option value="">Every active variant</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)" id="count-note">
        <input id="count-note" name="note" maxLength={200} className={cn(inputClasses, "h-11 w-64")} />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("inverse", "sm", "h-11 rounded-input")}
      >
        {pending ? "Opening…" : "Start a count"}
      </button>
      <div className="basis-full">
        <FormStatus state={state} success="" />
      </div>
    </form>
  );
}

type SheetLine = {
  id: string;
  sku: string;
  product: string;
  variant: string;
  expected: number;
  counted: number | null;
  stale: boolean;
};

/**
 * Count sheet. Variances update as you type; nothing changes stock until "Commit",
 * which applies every counted line in one transaction on the server.
 */
export function CountSheet({ countId, lines, open }: { countId: string; lines: SheetLine[]; open: boolean }) {
  const router = useRouter();
  const [state, save, saving] = useActionState<InventoryFormState, FormData>(recordCountsAction, null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.counted === null ? "" : String(l.counted)])),
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const [onlyOpen, setOnlyOpen] = useState(false);

  const variance = (l: SheetLine) => {
    const v = values[l.id];
    if (v === undefined || v.trim() === "" || !/^\d+$/.test(v.trim())) return null;
    return Number(v) - l.expected;
  };
  const summary = useMemo(() => {
    let counted = 0;
    let off = 0;
    for (const l of lines) {
      const d = variance(l);
      if (d === null) continue;
      counted++;
      if (d !== 0) off++;
    }
    return { counted, off };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- variance reads `values`
  }, [lines, values]);

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string; data?: unknown }>,
    done: (d: never) => string,
  ) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      if (r.ok) {
        setMessage({ ok: true, text: done(("data" in r ? r.data : undefined) as never) });
        router.refresh();
      } else setMessage({ ok: false, text: r.message ?? "Something went wrong." });
    });

  const shown = onlyOpen ? lines.filter((l) => (values[l.id] ?? "") === "" || l.stale) : lines;
  const stale = lines.filter((l) => l.stale).length;

  return (
    <form
      action={(fd) => {
        setDirty(false);
        save(fd);
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="countId" value={countId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          <span className="font-mono text-fg">{summary.counted}</span> of {lines.length} counted ·{" "}
          <span className={cn("font-mono", summary.off ? "text-warn" : "text-fg")}>{summary.off}</span> with a
          difference
          {dirty && <span className="ml-2 text-warn">· unsaved changes</span>}
        </p>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Only lines still to count
        </label>
      </div>

      {open && stale > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warn/60 p-4 text-sm"
        >
          <span>
            {stale} {stale === 1 ? "line has" : "lines have"} moved since its expected quantity was frozen (a
            shipment, a delivery or a correction). Refresh and recount {stale === 1 ? "it" : "them"} before
            committing.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => refreshStaleLinesAction(countId),
                (d: { lines: number }) => `${d.lines} lines refreshed; count them again.`,
              )
            }
            className={buttonClasses("secondary", "sm", "rounded-input")}
          >
            Refresh {stale === 1 ? "line" : "lines"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="label-mono p-3 text-left font-normal text-fg-subtle">Variant</th>
              <th
                className="label-mono p-3 text-right font-normal text-fg-subtle"
                title="Available + held by unshipped orders, when frozen"
              >
                Expected
              </th>
              <th className="label-mono p-3 text-right font-normal text-fg-subtle">Counted</th>
              <th className="label-mono p-3 text-right font-normal text-fg-subtle">Difference</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const d = variance(l);
              return (
                <tr key={l.id} className={cn("border-t border-line", l.stale && "bg-warn/5")}>
                  <td className="p-3">
                    <div className="font-medium">{l.product}</div>
                    <div className="text-xs text-fg-muted">
                      {l.variant} · <span className="font-mono">{l.sku}</span>
                      {l.stale && <span className="ml-2 text-warn">moved since frozen</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">{l.expected}</td>
                  <td className="p-3 text-right">
                    {open ? (
                      <input
                        aria-label={`Counted units of ${l.sku}`}
                        name={`counted:${l.id}`}
                        inputMode="numeric"
                        pattern="\d*"
                        value={values[l.id] ?? ""}
                        onChange={(e) => {
                          setDirty(true);
                          setValues((v) => ({ ...v, [l.id]: e.target.value }));
                        }}
                        className="h-10 w-20 rounded-input border border-line-strong bg-surface px-2 text-right font-mono"
                      />
                    ) : (
                      <span className="font-mono tabular-nums">{l.counted ?? "—"}</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "p-3 text-right font-mono tabular-nums",
                      d === null ? "text-fg-subtle" : d === 0 ? "text-fg-muted" : "text-warn",
                    )}
                  >
                    {d === null ? "—" : d > 0 ? `+${d}` : d}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || busy}
            className={buttonClasses("secondary", "md", "rounded-input")}
          >
            {saving ? "Saving…" : "Save progress"}
          </button>
          <button
            type="button"
            disabled={saving || busy || dirty || summary.counted === 0}
            title={dirty ? "Save your changes first" : undefined}
            onClick={() => {
              const lost = lines.length - summary.counted;
              const msg =
                `Apply ${summary.off} correction${summary.off === 1 ? "" : "s"} to stock?` +
                (lost ? ` ${lost} uncounted line${lost === 1 ? " is" : "s are"} left unchanged.` : "") +
                " This can't be undone.";
              if (!window.confirm(msg)) return;
              run(
                () => commitCountAction(countId),
                (d: { corrected: number; skipped: number }) =>
                  `Committed: ${d.corrected} ${d.corrected === 1 ? "correction" : "corrections"} applied, ` +
                  `${d.skipped} ${d.skipped === 1 ? "line" : "lines"} not counted.`,
              );
            }}
            className={buttonClasses("inverse", "md", "rounded-input")}
          >
            Commit count
          </button>
          <button
            type="button"
            disabled={saving || busy}
            onClick={() => {
              if (!window.confirm("Cancel this count? Nothing will change in stock.")) return;
              run(
                () => cancelCountAction(countId),
                () => "Count cancelled.",
              );
            }}
            className={buttonClasses("ghost", "md", "rounded-input text-warn")}
          >
            Cancel count
          </button>
        </div>
      )}
      <p
        role="status"
        className={cn(
          "min-h-5 text-[13px]",
          message?.ok === false || (state && !state.ok) ? "text-warn" : "text-accent",
        )}
      >
        {message?.text ?? (state ? (state.ok ? "Progress saved." : state.message) : "")}
      </p>
    </form>
  );
}
