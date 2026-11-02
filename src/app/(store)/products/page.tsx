import type { Metadata } from "next";
import { Suspense } from "react";
import { Listing, ListingSkeleton } from "@/components/catalog/listing";
import { parseListingQuery } from "@/lib/validation/catalog";

// Static on purpose, so it is sent in <head>. Canonical and noindex for filtered or
// paginated URLs come from src/proxy.ts as HTTP headers.
export const metadata: Metadata = {
  title: "All products",
  description: "Headphones, phones, wearables, speakers and accessories from NEXORA.",
};

async function Results({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  const query = parseListingQuery(await searchParams);
  return <Listing query={query} basePath="/products" />;
}

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="container-site py-12">
      <header className="mb-10 flex flex-col gap-2 border-b border-line pb-8">
        <span className="label-mono text-fg-subtle">Catalog</span>
        <h1 className="text-display-l">All products</h1>
      </header>
      <Suspense fallback={<ListingSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
