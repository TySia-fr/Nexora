"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteCategoryAction, saveCategoryAction, type AdminFormState } from "@/server/actions/admin";
import { inputBase } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Category = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  position: number;
  productCount?: number;
};

export function CategoryRow({ category }: { category: Category }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveCategoryAction, null);
  const [deleting, start] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const prefix = category.id ?? "new";
  return (
    <form
      action={action}
      className="grid gap-2 border-t border-line py-4 md:grid-cols-[1fr_1fr_2fr_80px_auto]"
    >
      {category.id && <input type="hidden" name="categoryId" value={category.id} />}
      {(["name", "slug", "description"] as const).map((f) => (
        <div key={f} className="flex flex-col gap-1">
          <label htmlFor={`${prefix}-${f}`} className="label-mono text-fg-subtle">
            {f}
          </label>
          <input
            id={`${prefix}-${f}`}
            name={f}
            defaultValue={category[f]}
            aria-invalid={Boolean(fe[f])}
            className={cn(inputBase, "h-10 w-full")}
          />
          {fe[f] && <span className="text-xs text-warn">{fe[f]}</span>}
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${prefix}-position`} className="label-mono text-fg-subtle">
          order
        </label>
        <input
          id={`${prefix}-position`}
          name="position"
          inputMode="numeric"
          defaultValue={category.position}
          className={cn(inputBase, "h-10 w-full")}
        />
      </div>
      <div className="flex items-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses(category.id ? "secondary" : "inverse", "sm", "h-10 rounded-input")}
        >
          {category.id ? "Save" : "Create"}
        </button>
        {category.id && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!window.confirm(`Delete category “${category.name}”?`)) return;
              setDeleteError(null);
              start(async () => {
                const r = await deleteCategoryAction(category.id!);
                if (!r.ok) setDeleteError(r.message);
              });
            }}
            className="h-10 text-xs text-fg-muted hover:text-warn"
          >
            Delete
          </button>
        )}
      </div>
      <p role="status" className="text-xs md:col-span-5">
        {state?.ok && <span className="text-accent">Saved.</span>}
        {state && !state.ok && !state.fieldErrors && <span className="text-warn">{state.message}</span>}
        {deleteError && <span className="text-warn">{deleteError}</span>}
        {category.productCount !== undefined && (
          <span className="text-fg-subtle"> {category.productCount} products</span>
        )}
      </p>
    </form>
  );
}
