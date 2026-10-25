import Link from "next/link";
import { Suspense } from "react";
import { requireViewer } from "@/server/session";
import { listWishlistProductIds } from "@/server/wishlist";
import { getProductsByIds } from "@/server/catalog";
import { ProductGrid } from "@/components/product/product-card";

async function Content() {
  const viewer = await requireViewer("/account/wishlist");
  const products = await getProductsByIds(await listWishlistProductIds(viewer.id));
  if (products.length === 0) {
    return (
      <p className="text-ash">
        Nothing saved yet. Tap the heart on any product to keep it here.{" "}
        <Link href="/products" className="text-paper underline underline-offset-4">
          Browse products
        </Link>
      </p>
    );
  }
  return <ProductGrid products={products} />;
}

export default function WishlistPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-4xl font-semibold tracking-[-0.03em]">Wishlist</h1>
      <Suspense fallback={<div className="h-60 animate-pulse rounded-card bg-graphite" aria-busy="true" />}>
        <Content />
      </Suspense>
    </div>
  );
}
