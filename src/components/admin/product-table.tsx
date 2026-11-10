"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setProductsStatusAction } from "@/server/actions/admin";
import { buttonClasses } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";
import { TableBox, td as baseTd, th } from "@/components/admin/ui";

const td = baseTd.replace("align-top", "align-middle");

export type ProductRow = {
  id: string;
  name: string;
  featured: boolean;
  category: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variants: number;
  stock: number;
  from: string;
  image: { url: string; alt: string } | null;
};

const STATUS_TONE: Record<ProductRow["status"], string> = {
  ACTIVE: "bg-accent/15 text-accent",
  DRAFT: "bg-well text-fg-muted",
  ARCHIVED: "bg-warn/10 text-warn",
};

/** Products table with row selection and bulk status changes. */
export function ProductTable({ rows }: { rows: ProductRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("ACTIVE");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () =>
    start(async () => {
      const res = await setProductsStatusAction([...selected], status);
      if (res.ok) {
        setMessage(
          `${res.data.count} product${res.data.count === 1 ? "" : "s"} set to ${status.toLowerCase()}.`,
        );
        setSelected(new Set());
      } else setMessage(res.message);
    });

  return (
    <>
      <div
        className="mb-3 flex min-h-11 flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-2 text-sm"
        aria-live="polite"
      >
        {selected.size === 0 ? (
          <span className="text-fg-muted">
            {message ?? "Select products to change their status together."}
          </span>
        ) : (
          <>
            <span className="font-medium">{selected.size} selected</span>
            <label htmlFor="bulk-status" className="sr-only">
              New status
            </label>
            <select
              id="bulk-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`${inputBase} h-9 w-auto`}
            >
              <option value="ACTIVE">Publish (active)</option>
              <option value="DRAFT">Unpublish (draft)</option>
              <option value="ARCHIVED">Archive</option>
            </select>
            <button
              type="button"
              onClick={apply}
              disabled={pending}
              className={buttonClasses("inverse", "sm", "rounded-input")}
            >
              {pending ? "Applying…" : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-fg-muted hover:text-fg"
            >
              Clear
            </button>
          </>
        )}
      </div>
      <TableBox>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${th} w-10`}>
                <input
                  type="checkbox"
                  aria-label="Select all products on this page"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-4 accent-[var(--color-accent)]"
                />
              </th>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Variants</th>
              <th className={`${th} text-right`}>Stock</th>
              <th className={`${th} text-right`}>From</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={7}>
                  No products match.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className={selected.has(p.id) ? "bg-surface" : "hover:bg-surface/60"}>
                <td className={td}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                </td>
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-input bg-[#f5f5f2]">
                      {p.image && (
                        <Image src={p.image.url} alt="" fill sizes="40px" className="object-contain p-0.5" />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      {p.featured && <span className="label-mono text-accent">featured</span>}
                    </span>
                  </div>
                </td>
                <td className={`${td} text-fg-muted`}>{p.category}</td>
                <td className={td}>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_TONE[p.status]}`}>
                    {p.status.toLowerCase()}
                  </span>
                </td>
                <td className={`${td} text-right font-mono text-fg-muted`}>{p.variants}</td>
                <td className={`${td} text-right font-mono ${p.stock === 0 ? "text-warn" : ""}`}>
                  {p.stock}
                </td>
                <td className={`${td} text-right font-mono`}>{p.from}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
    </>
  );
}
