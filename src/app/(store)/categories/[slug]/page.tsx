import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Listing, ListingSkeleton } from "@/components/catalog/listing";
import { parseListingQuery } from "@/lib/validation/catalog";
import { getCategory } from "@/server/catalog";
import { env } from "@/lib/env";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { BUILD_PLACEHOLDER } from "@/lib/static-params";
import { JsonLd } from "@/components/seo/json-ld";

/**
 * Incremental static regeneration (Cache Components): the build has no database, so
 * it prerenders only a placeholder. Each real category is rendered on its first visit
 * and cached, with its metadata in <head>. Canonical and noindex for filtered URLs
 * come from src/proxy.ts; the product grid depends on the query string and streams.
 */
export function generateStaticParams() {
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadCategory(params: PageProps<"/categories/[slug]">["params"]) {
  const { slug } = await params;
  if (slug === BUILD_PLACEHOLDER) return null;
  return getCategory(slug);
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const category = await loadCategory(params);
  if (!category) return { title: "Category not found", robots: { index: false } };
  return pageMetadata({
    title: category.name,
    description: category.description,
    path: `/categories/${category.slug}`,
    canonical: false,
  });
}

async function Results({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: PageProps<"/categories/[slug]">["searchParams"];
}) {
  const query = { ...parseListingQuery(await searchParams), category: slug };
  return <Listing query={query} basePath={`/categories/${slug}`} lockedCategory={slug} />;
}

async function CategoryContent({ params, searchParams }: PageProps<"/categories/[slug]">) {
  const category = await loadCategory(params);
  if (!category) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbLd(env.APP_URL, [
          { name: "Home", path: "/" },
          { name: category.name, path: `/categories/${category.slug}` },
        ])}
      />
      <header className="mb-10 flex flex-col gap-3 border-b border-line pb-8">
        <span className="label-mono text-fg-subtle">Category · {category.productCount} products</span>
        <h1 className="text-display-l">{category.name}</h1>
        <p className="max-w-xl text-fg-muted">{category.description}</p>
      </header>
      <Suspense fallback={<ListingSkeleton />}>
        <Results slug={category.slug} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

export default function CategoryPage(props: PageProps<"/categories/[slug]">) {
  return (
    <div className="container-site py-12">
      <Suspense fallback={<ListingSkeleton />}>
        <CategoryContent {...props} />
      </Suspense>
    </div>
  );
}
