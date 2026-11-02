import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getLiveStock, getProductBySlug, getRelatedProducts, type ProductDetailView } from "@/server/catalog";
import { getViewer } from "@/server/session";
import { isInWishlist } from "@/server/wishlist";
import { ProductPurchase, type LivePurchaseData } from "@/components/product/product-purchase";
import { ProductGrid } from "@/components/product/product-card";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { env } from "@/lib/env";
import { breadcrumbLd, offerPolicies, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { BUILD_PLACEHOLDER } from "@/lib/static-params";

/**
 * Incremental static regeneration: every product page is rendered on its first visit
 * and cached (title and description in <head>, content, gallery, structured data).
 * Only the purchase panel's data is request-time: live stock, the visitor's wishlist
 * and the ?variant= selection, streamed as a promise (see ProductPurchase). The build itself only prerenders a placeholder (no database).
 */
export function generateStaticParams() {
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadProduct(params: PageProps<"/products/[slug]">["params"]) {
  const { slug } = await params;
  if (slug === BUILD_PLACEHOLDER) return null;
  return getProductBySlug(slug);
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await loadProduct(params);
  if (!product) return { title: "Product not found", robots: { index: false } };
  const image = product.images[0];
  return pageMetadata({
    // "Halo One — Over-ear headphones · NEXORA": the product type is what people search for.
    title: `${product.name} — ${product.tagline}`,
    description: `${product.tagline}. ${product.description}`,
    path: `/products/${product.slug}`,
    image: image && { url: image.url, width: image.width, height: image.height, alt: image.alt },
  });
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
    category: p.category.name,
    url,
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      name: v.name,
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      itemCondition: "https://schema.org/NewCondition",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${url}?variant=${encodeURIComponent(v.sku)}`,
      seller: { "@id": `${env.APP_URL}/#organization` },
      ...offerPolicies(env.APP_URL, v.priceCents),
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

/**
 * Request-time data for the purchase panel. Returned as a promise and not awaited here,
 * so the cached page doesn't wait for it; the client panel applies it on arrival.
 */
async function loadLivePurchase(
  productId: string,
  searchParams: PageProps<"/products/[slug]">["searchParams"],
): Promise<LivePurchaseData> {
  await connection();
  const [stock, viewer, sp] = await Promise.all([getLiveStock(productId), getViewer(), searchParams]);
  const saved = viewer ? await isInWishlist(viewer.id, productId) : false;
  return {
    stock: Object.fromEntries(stock),
    signedIn: Boolean(viewer),
    saved,
    initialSku: typeof sp.variant === "string" ? sp.variant : undefined,
  };
}

async function ProductContent({ params, searchParams }: PageProps<"/products/[slug]">) {
  const product = await loadProduct(params);
  if (!product) notFound();

  return (
    <>
      <JsonLd
        data={[
          structuredData(product),
          breadcrumbLd(env.APP_URL, [
            { name: "Home", path: "/" },
            { name: product.category.name, path: `/categories/${product.category.slug}` },
            { name: product.name, path: `/products/${product.slug}` },
          ]),
        ]}
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
        <ProductPurchase product={product} live={loadLivePurchase(product.id, searchParams)} />
      </section>

      <section className="container-site pb-6" aria-label="Details">
        <div className="rule-tick grid gap-14 pt-8 md:grid-cols-12 md:gap-8">
          <div className="flex flex-col gap-6 md:col-span-7" data-reveal>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-display-m">Specifications</h2>
              <span className="label-mono text-fg-subtle">01 / Technical</span>
            </div>
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
          <div className="flex flex-col gap-6 md:col-span-5" data-reveal>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-display-m">Features</h2>
              <span className="label-mono text-fg-subtle">02 / Design</span>
            </div>
            <ol className="flex flex-col" role="list">
              {product.features.map((f, i) => (
                <li key={f.title} className="grid grid-cols-[32px_1fr] gap-3 border-t border-line py-5">
                  <span className="label-mono pt-1 text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-medium">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-fg-muted">{f.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        id="reviews"
        className="container-site scroll-mt-24 py-20 md:py-28"
        aria-labelledby="reviews-title"
      >
        <div className="rule-tick flex flex-wrap gap-14 pt-8">
          <div className="flex flex-[1_1_240px] flex-col gap-2">
            <span className="label-mono text-fg-subtle">03 / Reviews</span>
            <h2 id="reviews-title" className="text-display-m">
              Reviews
            </h2>
            {product.rating ? (
              <>
                <span className="mt-4 font-display text-7xl font-medium tracking-[-0.04em]">
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
    <section aria-labelledby="related-title" className="container-site pb-24">
      <div className="rule-tick flex flex-col gap-8 pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="related-title" className="text-display-m">
            Pairs well with
          </h2>
          <span className="label-mono text-fg-subtle">04 / Related</span>
        </div>
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
          <div className="aspect-square animate-pulse rounded-card bg-well" />
          <div className="h-96 animate-pulse rounded-card bg-well" />
        </div>
      }
    >
      <ProductContent {...props} />
    </Suspense>
  );
}
