import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getLiveStock, getProductBySlug, getRelatedProducts, type ProductDetailView } from "@/server/catalog";
import { getViewer } from "@/server/session";
import { isInWishlist } from "@/server/wishlist";
import { ProductPurchase } from "@/components/product/product-purchase";
import { ProductGrid } from "@/components/product/product-card";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { env } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const image = product.images[0];
  return {
    title: product.name,
    description: `${product.tagline}. ${product.description}`.slice(0, 160),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} · NEXORA`,
      description: product.tagline,
      images: image ? [{ url: image.url, width: image.width, height: image.height, alt: image.alt }] : [],
    },
  };
}

/** schema.org data built only from stored facts: real stock, real reviews. */
function structuredData(p: ProductDetailView) {
  const url = `${env.APP_URL}/products/${p.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images.map((i) => `${env.APP_URL}${i.url}`),
    brand: { "@type": "Brand", name: "NEXORA" },
    url,
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      name: v.name,
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${url}?variant=${encodeURIComponent(v.sku)}`,
    })),
    ...(p.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.rating.average,
            reviewCount: p.rating.count,
          },
          review: p.reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            author: { "@type": "Person", name: r.author },
            name: r.title,
            reviewBody: r.body,
          })),
        }
      : {}),
  };
}

async function ProductContent({ params, searchParams }: PageProps<"/products/[slug]">) {
  await connection();
  const { slug } = await params;
  const cached = await getProductBySlug(slug);
  if (!cached) notFound();
  // Content comes from the cache; stock is always read live.
  const stock = await getLiveStock(cached.id);
  const product: ProductDetailView = {
    ...cached,
    variants: cached.variants.flatMap((v) => (stock.has(v.id) ? [{ ...v, stock: stock.get(v.id)! }] : [])),
  };
  if (product.variants.length === 0) notFound();
  const sp = await searchParams;
  const initialSku = typeof sp.variant === "string" ? sp.variant : undefined;
  const viewer = await getViewer();
  const saved = viewer ? await isInWishlist(viewer.id, product.id) : false;

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped cannot break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(product)).replace(/</g, "\\u003c") }}
      />
      <div className="container-site pt-6">
        <nav aria-label="Breadcrumb" className="label-mono text-fg-subtle">
          <ol className="flex flex-wrap gap-2" role="list">
            <li>
              <Link href="/" className="hover:text-fg">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/categories/${product.category.slug}`} className="hover:text-fg">
                {product.category.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-fg">
              {product.name}
            </li>
          </ol>
        </nav>
      </div>

      <section className="container-site pt-8 pb-24">
        <ProductPurchase
          product={product}
          initialSku={initialSku}
          signedIn={Boolean(viewer)}
          initiallySaved={saved}
        />
      </section>

      <section className="border-t border-line" aria-label="Details">
        <div className="container-site grid gap-14 py-18 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-semibold">Technical specifications</h2>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {product.specs.map((s) => (
                  <tr key={s.label} className="border-b border-line">
                    <th
                      scope="row"
                      className="label-mono w-2/5 py-3.5 pr-4 text-left align-top font-normal text-fg-subtle"
                    >
                      {s.label}
                    </th>
                    <td className="py-3.5">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-fg-subtle">
              NEXORA is a fictional brand; these specifications are illustrative.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-semibold">Features</h2>
            {product.features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-5"
              >
                <h3 className="font-medium">{f.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="reviews" className="scroll-mt-24 border-t border-line" aria-labelledby="reviews-title">
        <div className="container-site flex flex-wrap gap-14 py-18">
          <div className="flex flex-[1_1_240px] flex-col gap-2">
            <h2 id="reviews-title" className="text-2xl font-semibold">
              Reviews
            </h2>
            {product.rating ? (
              <>
                <span className="text-6xl font-semibold tracking-[-0.03em]">
                  {product.rating.average.toFixed(1)}
                </span>
                <span className="text-[13px] text-fg-subtle">
                  Average of {product.rating.count} {product.rating.count === 1 ? "review" : "reviews"}
                </span>
              </>
            ) : (
              <p className="text-sm text-fg-muted">No reviews yet.</p>
            )}
          </div>
          <div className="flex min-w-0 flex-[999_1_520px] flex-col">
            {product.reviews.map((r) => (
              <article key={r.id} className="flex flex-col gap-2 border-b border-line py-6">
                <div className="flex justify-between gap-3">
                  <h3 className="font-medium">{r.title}</h3>
                  <span className="font-mono text-xs text-accent" aria-label={`Rated ${r.rating} out of 5`}>
                    {r.rating} / 5
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-fg-muted">{r.body}</p>
                <span className="label-mono text-fg-subtle">
                  {r.author}
                  {r.verifiedPurchase && " · Verified purchase"}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Related productId={product.id} categorySlug={product.category.slug} />
      </Suspense>
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}

async function Related({ productId, categorySlug }: { productId: string; categorySlug: string }) {
  const related = await getRelatedProducts(productId, categorySlug);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className="border-t border-line">
      <div className="container-site flex flex-col gap-7 py-18">
        <h2 id="related-title" className="text-2xl font-semibold">
          Pairs well with
        </h2>
        <ProductGrid products={related} />
      </div>
    </section>
  );
}

export default function ProductPage(props: PageProps<"/products/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="container-site grid gap-12 py-14 md:grid-cols-2" aria-busy="true">
          <div className="aspect-square animate-pulse rounded-card bg-surface" />
          <div className="h-96 animate-pulse rounded-card bg-surface" />
        </div>
      }
    >
      <ProductContent {...props} />
    </Suspense>
  );
}
