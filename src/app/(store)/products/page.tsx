import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing, ListingSkeleton } from "@/components/catalog/listing";
import { parseListingQuery } from "@/lib/validation/catalog";

export const metadata: Metadata = {
  title: "All products",
  description: "Headphones, phones, wearables, speakers and accessories from NEXORA.",
  alternates: { canonical: "/products" },
};

async function Results({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  const query = parseListingQuery(await searchParams);
  return <Listing query={query} basePath="/products" />;
}

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="container-site py-12">
      <header className="mb-10 flex flex-col gap-2 border-b border-line pb-8">
        <span className="label-mono text-fog">Catalog</span>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">All products</h1>
      </header>
      <Suspense fallback={<ListingSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
