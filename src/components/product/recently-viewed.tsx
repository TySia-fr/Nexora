"use client";

import { useEffect, useState } from "react";
import { recentlyViewedAction } from "@/server/actions/products";
import type { ProductCardView } from "@/server/catalog";
import { ProductGrid } from "@/components/product/product-card";

const RECENT_KEY = "nx:recently-viewed";

/** Reads ids from this browser's localStorage only; nothing is tracked server-side. */
export function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<ProductCardView[]>([]);

  useEffect(() => {
    let ids: string[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
      if (Array.isArray(raw))
        ids = raw.filter((x): x is string => typeof x === "string" && x !== excludeId).slice(0, 4);
    } catch {
      return;
    }
    if (ids.length === 0) return;
    let cancelled = false;
    recentlyViewedAction(ids).then((p) => !cancelled && setProducts(p));
    return () => {
      cancelled = true;
    };
  }, [excludeId]);

  if (products.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="border-t border-line">
      <div className="container-site flex flex-col gap-7 py-18">
        <h2 id="recent-title" className="text-2xl font-semibold">
          Recently viewed
        </h2>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
