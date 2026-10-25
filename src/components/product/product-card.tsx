import Image from "next/image";
import Link from "next/link";
import type { ProductCardView } from "@/server/catalog";
import { Price } from "@/components/ui/price";

export function ProductCard({ product, priority = false }: { product: ProductCardView; priority?: boolean }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-3.5 rounded-card focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-surface">
        {product.image && (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-opacity duration-300 group-hover:opacity-0"
          />
        )}
        {product.hoverImage && (
          <Image
            src={product.hoverImage.url}
            alt=""
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {!product.inStock && (
          <span className="label-mono absolute top-3.5 left-3.5 rounded-full border border-line-strong bg-canvas/80 px-2 py-1 text-fg-muted">
            Out of stock
          </span>
        )}
      </div>
      <div className="flex justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-medium group-hover:text-accent">{product.name}</span>
          <span className="text-[13px] text-fg-subtle">
            {product.tagline}
            {product.colors.length > 1 && ` · ${product.colors.length} options`}
          </span>
          {product.colors.length > 1 && (
            <span className="mt-1 flex gap-1.5" aria-hidden="true">
              {product.colors.map((c) => (
                <span
                  key={c.name}
                  className="size-3 rounded-full border border-line-strong"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </span>
          )}
        </div>
        <Price cents={product.priceFromCents} from={product.hasPriceRange} className="shrink-0 text-sm" />
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: ProductCardView[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4" role="list">
      {products.map((p, i) => (
        <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
