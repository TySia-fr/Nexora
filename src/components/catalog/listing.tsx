import Link from "next/link";
import { X } from "lucide-react";
import { listProducts, getCategories, type CategoryView } from "@/server/catalog";
import { listingHref, type ListingQuery, SORT_OPTIONS } from "@/lib/validation/catalog";
import { ProductGrid } from "@/components/product/product-card";
import { SortSelect } from "@/components/catalog/sort-select";
import { inputClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  popular: "Most popular",
};

/**
 * Server-rendered product listing. Filters are a plain GET form, so they work
 * without JavaScript and every state has a shareable URL.
 */
export async function Listing({
  query,
  basePath,
  lockedCategory,
}: {
  query: ListingQuery;
  basePath: string;
  lockedCategory?: string;
}) {
  const [result, categories] = await Promise.all([listProducts(query), getCategories()]);
  const effective = lockedCategory ? { ...query, category: undefined } : query;

  const chips: { label: string; href: string }[] = [];
  if (query.q)
    chips.push({
      label: `“${query.q}”`,
      href: listingHref(basePath, { ...effective, q: undefined, page: 1 }),
    });
  if (!lockedCategory && query.category) {
    const name = categories.find((c) => c.slug === query.category)?.name ?? query.category;
    chips.push({ label: name, href: listingHref(basePath, { ...effective, category: undefined, page: 1 }) });
  }
  if (query.min !== undefined)
    chips.push({
      label: `From €${query.min}`,
      href: listingHref(basePath, { ...effective, min: undefined, page: 1 }),
    });
  if (query.max !== undefined)
    chips.push({
      label: `Up to €${query.max}`,
      href: listingHref(basePath, { ...effective, max: undefined, page: 1 }),
    });
  if (query.inStock)
    chips.push({
      label: "In stock",
      href: listingHref(basePath, { ...effective, inStock: undefined, page: 1 }),
    });

  const formProps = { query, basePath, lockedCategory, categories };

  return (
    <div className="flex flex-wrap gap-x-12 gap-y-8">
      <aside className="w-full lg:w-60 lg:shrink-0" aria-label="Filters">
        <details className="group rounded-card border border-line lg:hidden">
          <summary className="label-mono flex h-12 cursor-pointer items-center justify-between px-4 text-mist">
            Filters {chips.length > 0 && `(${chips.length})`}
            <span aria-hidden="true" className="transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <FiltersForm idPrefix="m" className="p-4" {...formProps} />
        </details>
        <FiltersForm idPrefix="d" className="hidden lg:flex" {...formProps} />
      </aside>

      <section className="min-w-0 flex-[999_1_560px]" aria-labelledby="results-count">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p id="results-count" className="text-sm text-ash" aria-live="polite">
            {result.total} {result.total === 1 ? "product" : "products"}
          </p>
          <SortSelect value={query.sort} labels={SORT_LABELS} />
        </div>

        {chips.length > 0 && (
          <ul className="mb-6 flex flex-wrap gap-2" aria-label="Active filters" role="list">
            {chips.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] hover:border-paper"
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <X className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={lockedCategory ? basePath : "/products"}
                className="flex h-9 items-center px-2 text-[13px] text-ash underline-offset-4 hover:underline"
              >
                Clear all
              </Link>
            </li>
          </ul>
        )}

        {result.products.length > 0 ? (
          <ProductGrid products={result.products} priorityCount={4} />
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-card border border-line p-10">
            <h2 className="text-xl font-medium">No products match these filters.</h2>
            <p className="text-sm text-ash">Try removing a filter or widening the price range.</p>
            <Link href={lockedCategory ? basePath : "/products"} className={buttonClasses("secondary", "sm")}>
              Clear all filters
            </Link>
          </div>
        )}

        {result.pageCount > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-12 flex items-center justify-between gap-4 border-t border-line pt-6"
          >
            {query.page > 1 ? (
              <Link
                href={listingHref(basePath, { ...effective, page: query.page - 1 })}
                className={buttonClasses("secondary", "sm")}
                rel="prev"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="label-mono text-fog">
              Page {Math.min(query.page, result.pageCount)} of {result.pageCount}
            </span>
            {query.page < result.pageCount ? (
              <Link
                href={listingHref(basePath, { ...effective, page: query.page + 1 })}
                className={buttonClasses("secondary", "sm")}
                rel="next"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="flex gap-12" aria-busy="true" aria-label="Loading products">
      <div className="hidden w-60 shrink-0 lg:block" />
      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-graphite" />
        ))}
      </div>
    </div>
  );
}

function FiltersForm({
  idPrefix,
  className,
  query,
  basePath,
  lockedCategory,
  categories,
}: {
  idPrefix: string;
  className?: string;
  query: ListingQuery;
  basePath: string;
  lockedCategory?: string;
  categories: CategoryView[];
}) {
  return (
    <form method="get" action={basePath} className={cn("flex flex-col gap-6", className)}>
      {query.q && <input type="hidden" name="q" value={query.q} />}
      {query.sort !== "newest" && <input type="hidden" name="sort" value={query.sort} />}
      {!lockedCategory && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label-mono mb-2 text-fog">Category</legend>
          <label className="flex min-h-9 items-center gap-2.5 text-sm">
            <input
              type="radio"
              name="category"
              value=""
              defaultChecked={!query.category}
              className="size-4 accent-signal"
            />
            All
          </label>
          {categories.map((c) => (
            <label key={c.slug} className="flex min-h-9 items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="category"
                value={c.slug}
                defaultChecked={query.category === c.slug}
                className="size-4 accent-signal"
              />
              {c.name}
              <span className="ml-auto font-mono text-xs text-fog">{c.productCount}</span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="label-mono mb-2 text-fog">Price (€)</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-min`}>
            Minimum price in euros
          </label>
          <input
            id={`${idPrefix}-min`}
            name="min"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            defaultValue={query.min}
            className={cn(inputClasses, "h-11")}
          />
          <span aria-hidden="true" className="text-fog">
            –
          </span>
          <label className="sr-only" htmlFor={`${idPrefix}-max`}>
            Maximum price in euros
          </label>
          <input
            id={`${idPrefix}-max`}
            name="max"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max"
            defaultValue={query.max}
            className={cn(inputClasses, "h-11")}
          />
        </div>
      </fieldset>
      <label className="flex min-h-9 items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="inStock"
          value="1"
          defaultChecked={query.inStock}
          className="size-4 accent-signal"
        />
        In stock only
      </label>
      <button type="submit" className={buttonClasses("inverse", "sm", "rounded-input")}>
        Apply filters
      </button>
    </form>
  );
}
