import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Listing, ListingSkeleton } from "@/components/catalog/listing";
import { parseListingQuery } from "@/lib/validation/catalog";
import { getCategory } from "@/server/catalog";

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found", robots: { index: false } };
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

async function CategoryContent({ params, searchParams }: PageProps<"/categories/[slug]">) {
  await connection();
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const query = { ...parseListingQuery(await searchParams), category: category.slug };
  return (
    <>
      <header className="mb-10 flex flex-col gap-3 border-b border-line pb-8">
        <span className="label-mono text-fg-subtle">Category · {category.productCount} products</span>
        <h1 className="text-display-l">{category.name}</h1>
        <p className="max-w-xl text-fg-muted">{category.description}</p>
      </header>
      <Listing query={query} basePath={`/categories/${category.slug}`} lockedCategory={category.slug} />
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
