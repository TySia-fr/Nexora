"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  adjustStockAction,
  deleteProductAction,
  saveProductAction,
  type AdminFormState,
} from "@/server/actions/admin";
import { Field, Input, inputBase, inputClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type VariantRow = {
  key: string;
  id?: string;
  sku: string;
  name: string;
  colorHex: string;
  price: string;
  stock: string;
  isActive: boolean;
};

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  categoryId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  featured: boolean;
  specs: string;
  features: string;
  variants: Omit<VariantRow, "key">[];
};

/** Applies a +/- delta atomically on the server instead of overwriting stock. */
function StockAdjuster({
  variantId,
  stock,
  label,
  onChange,
}: {
  variantId: string;
  stock: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const [delta, setDelta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn("w-10 font-mono", stock === 0 && "text-amber")}
        aria-label={`${label} current stock`}
      >
        {stock}
      </span>
      <input
        aria-label={`${label} stock change, for example 10 or -2`}
        value={delta}
        placeholder="±"
        onChange={(e) => setDelta(e.target.value)}
        className={cn(inputBase, "h-10 w-16 font-mono")}
      />
      <button
        type="button"
        disabled={pending || !delta}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await adjustStockAction(variantId, Number(delta));
            if (r.ok) {
              onChange(r.data.stock);
              setDelta("");
            } else setError(r.message);
          });
        }}
        className="h-10 rounded-input border border-line-strong px-2.5 text-xs hover:border-paper disabled:text-fog"
      >
        Apply
      </button>
      {error && (
        <span role="alert" className="text-xs text-amber">
          {error}
        </span>
      )}
    </div>
  );
}

let counter = 0;
const newKey = () => `new-${++counter}`;

export function ProductForm({
  initial,
  categories,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveProductAction, null);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rows, setRows] = useState<VariantRow[]>(() =>
    initial.variants.length
      ? initial.variants.map((v) => ({ ...v, key: v.id ?? newKey() }))
      : [{ key: newKey(), sku: "", name: "", colorHex: "", price: "", stock: "0", isActive: true }],
  );
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const update = (key: string, patch: Partial<VariantRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const field = (name: "name" | "slug" | "tagline", label: string) => (
    <Field id={name} label={label} error={fe[name]}>
      <Input id={name} name={name} defaultValue={initial[name]} aria-invalid={Boolean(fe[name])} required />
    </Field>
  );

  return (
    <form action={action} noValidate className="flex flex-col gap-10">
      {initial.id && <input type="hidden" name="productId" value={initial.id} />}
      {state && !state.ok && (
        <p role="alert" className="rounded-card border border-amber/60 p-4 text-sm text-amber">
          {state.message}
          {state.fieldErrors && Object.keys(fe).some((k) => k.startsWith("variants")) && (
            <>
              <br />
              {Object.entries(fe)
                .filter(([k]) => k.startsWith("variants"))
                .map(([k, m]) => `Variant ${Number(k.split(".")[1]) + 1}: ${m}`)
                .join(" · ")}
            </>
          )}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {field("name", "Name")}
        <div>
          {field("slug", "URL slug")}
          <p className="mt-1 text-xs text-fog">
            Lowercase letters, numbers and dashes. Changing it breaks old links.
          </p>
        </div>
        {field("tagline", "Tagline")}
        <Field id="categoryId" label="Category" error={fe.categoryId}>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={initial.categoryId}
            className={inputClasses}
          >
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field id="description" label="Description" error={fe.description}>
            <textarea
              id="description"
              name="description"
              defaultValue={initial.description}
              rows={4}
              className={cn(inputClasses, "h-auto py-3")}
            />
          </Field>
        </div>
        <Field id="specs" label="Specifications — one “Label: value” per line" error={fe.specs}>
          <textarea
            id="specs"
            name="specs"
            defaultValue={initial.specs}
            rows={6}
            className={cn(inputClasses, "h-auto py-3 font-mono text-sm")}
          />
        </Field>
        <Field id="features" label="Features — one “Title: description” per line" error={fe.features}>
          <textarea
            id="features"
            name="features"
            defaultValue={initial.features}
            rows={6}
            className={cn(inputClasses, "h-auto py-3 font-mono text-sm")}
          />
        </Field>
        <Field id="status" label="Status">
          <select id="status" name="status" defaultValue={initial.status} className={inputClasses}>
            <option value="DRAFT">Draft — hidden</option>
            <option value="ACTIVE">Active — visible and purchasable</option>
            <option value="ARCHIVED">Archived — hidden, kept for order history</option>
          </select>
        </Field>
        <label className="flex items-center gap-2.5 self-end pb-3 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={initial.featured}
            className="size-4 accent-signal"
          />{" "}
          Featured on the homepage
        </label>
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Variants</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="label-mono text-left text-fog">
                <th className="p-2 font-normal">SKU</th>
                <th className="p-2 font-normal">Name</th>
                <th className="p-2 font-normal">Colour</th>
                <th className="p-2 font-normal">Price €</th>
                <th className="p-2 font-normal">Stock</th>
                <th className="p-2 font-normal">Active</th>
                <th className="p-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="p-1.5">
                    <input type="hidden" name="variant.id" value={r.id ?? ""} />
                    <input
                      aria-label={`Variant ${i + 1} SKU`}
                      name="variant.sku"
                      value={r.sku}
                      onChange={(e) => update(r.key, { sku: e.target.value })}
                      aria-invalid={Boolean(fe[`variants.${i}.sku`])}
                      className={cn(inputBase, "h-10 w-40 font-mono text-sm uppercase")}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label={`Variant ${i + 1} name`}
                      name="variant.name"
                      value={r.name}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                      aria-invalid={Boolean(fe[`variants.${i}.name`])}
                      className={cn(inputBase, "h-10 w-44")}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label={`Variant ${i + 1} colour hex`}
                      name="variant.colorHex"
                      value={r.colorHex}
                      placeholder="#2A2A2F"
                      onChange={(e) => update(r.key, { colorHex: e.target.value })}
                      aria-invalid={Boolean(fe[`variants.${i}.colorHex`])}
                      className={cn(inputBase, "h-10 w-28 font-mono text-sm")}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      aria-label={`Variant ${i + 1} price in euros`}
                      name="variant.price"
                      inputMode="decimal"
                      value={r.price}
                      onChange={(e) => update(r.key, { price: e.target.value })}
                      aria-invalid={Boolean(fe[`variants.${i}.price`])}
                      className={cn(inputBase, "h-10 w-24 font-mono")}
                    />
                  </td>
                  <td className="p-1.5">
                    {r.id ? (
                      <>
                        <input type="hidden" name="variant.stock" value={r.stock} />
                        <StockAdjuster
                          variantId={r.id}
                          stock={Number(r.stock)}
                          label={`Variant ${i + 1}`}
                          onChange={(n) => update(r.key, { stock: String(n) })}
                        />
                      </>
                    ) : (
                      <input
                        aria-label={`Variant ${i + 1} initial stock`}
                        name="variant.stock"
                        inputMode="numeric"
                        value={r.stock}
                        onChange={(e) => update(r.key, { stock: e.target.value })}
                        aria-invalid={Boolean(fe[`variants.${i}.stock`])}
                        className={cn(inputBase, "h-10 w-20 font-mono")}
                      />
                    )}
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      aria-label={`Variant ${i + 1} active`}
                      type="checkbox"
                      name="variant.active"
                      value={String(i)}
                      checked={r.isActive}
                      onChange={(e) => update(r.key, { isActive: e.target.checked })}
                      className="size-4 accent-signal"
                    />
                  </td>
                  <td className="p-1.5">
                    <button
                      type="button"
                      aria-label={`Remove variant ${i + 1}`}
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      className="flex size-10 items-center justify-center text-ash hover:text-amber disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              { key: newKey(), sku: "", name: "", colorHex: "", price: "", stock: "0", isActive: true },
            ])
          }
          className={buttonClasses("secondary", "sm", "self-start")}
        >
          <Plus className="size-4" aria-hidden="true" /> Add variant
        </button>
        <p className="text-xs text-fog">
          Removing a variant that appears in past orders deactivates it instead of deleting it.
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create product"}
        </button>
        {initial.id && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this product permanently? Products that were ordered can only be archived.",
                )
              )
                return;
              setDeleteError(null);
              startDelete(async () => {
                const r = await deleteProductAction(initial.id!);
                if (r && !r.ok) setDeleteError(r.message);
              });
            }}
            className="text-sm text-ash hover:text-amber"
          >
            Delete product
          </button>
        )}
        {deleteError && (
          <p role="alert" className="text-sm text-amber">
            {deleteError}
          </p>
        )}
      </div>
    </form>
  );
}
