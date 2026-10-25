import Image from "next/image";
import Link from "next/link";
import type { ProductCardView } from "@/server/catalog";
import { Price } from "@/components/ui/price";
import { cn } from "@/lib/cn";

export function ProductCard({
  product,
  priority = false,
  index,
  feature = false,
  sizes = "(min-width: 1280px) 320px, (min-width: 768px) 33vw, 50vw",
}: {
  product: ProductCardView;
  priority?: boolean;
  /** Catalogue index shown as a small technical label. */
  index?: number;
  /** Larger editorial tile. */
  feature?: boolean;
  sizes?: string;
}) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col gap-4 rounded-card focus-visible:outline-offset-4"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-card bg-well",
          feature ? "aspect-[4/5] md:aspect-auto md:min-h-[420px] md:flex-1" : "aspect-[4/5]",
        )}
      >
        {product.image && (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            priority={priority}
            sizes={sizes}
            className={cn(
              "transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]",
              // The feature tile is taller than the square render: show the whole object.
              feature ? "object-contain md:p-[6%]" : "object-cover",
              product.hoverImage && "group-hover:opacity-0",
            )}
          />
        )}
        {product.hoverImage && (
          <Image
            src={product.hoverImage.url}
            alt=""
            fill
            sizes={sizes}
            className="scale-[1.06] object-cover opacity-0 transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-100 group-hover:opacity-100"
          />
        )}
        <div className="label-mono pointer-events-none absolute inset-x-3.5 top-3.5 flex items-start justify-between text-fg-subtle">
          {index !== undefined ? <span>N°{String(index).padStart(2, "0")}</span> : <span />}
          {!product.inStock ? (
            <span className="rounded-full border border-line-strong bg-canvas/85 px-2 py-1 text-fg-muted">
              Out of stock
            </span>
          ) : (
            <span>{product.categoryName}</span>
          )}
        </div>
        <span
          aria-hidden="true"
          className="absolute right-3.5 bottom-3.5 flex size-9 translate-y-1 items-center justify-center rounded-full bg-fg text-canvas opacity-0 transition-[opacity,transform] duration-300 ease-[var(--ease-out-expo)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 12L12 4M6 4h6v6" />
          </svg>
        </span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={cn("truncate font-medium", feature ? "text-lg md:text-xl" : "text-[15px]")}>
            {product.name}
          </span>
          <span className="text-[13px] text-fg-subtle">{product.tagline}</span>
          {product.colors.length > 1 && (
            <span className="mt-1.5 flex items-center gap-1.5">
              {product.colors.map((c) => (
                <span
                  key={c.name}
                  aria-hidden="true"
                  className="size-2.5 rounded-full ring-1 ring-fg/15"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <span className="label-mono ml-1 text-fg-subtle">{product.colors.length} finishes</span>
            </span>
          )}
        </div>
        <Price
          cents={product.priceFromCents}
          from={product.hasPriceRange}
          className="shrink-0 font-mono text-[13px]"
        />
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
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4" role="list">
      {products.map((p, i) => (
        <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
