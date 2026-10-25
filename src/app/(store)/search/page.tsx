import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Listing, ListingSkeleton } from "@/components/catalog/listing";
import { SearchBox } from "@/components/catalog/search-box";
import { parseListingQuery } from "@/lib/validation/catalog";

export const metadata: Metadata = {
  title: "Search",
  // Search result pages are infinite and thin: keep them out of the index.
  robots: { index: false, follow: true },
};

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const query = parseListingQuery(await searchParams);
  return (
    <>
      <div className="mb-12 max-w-2xl">
        <SearchBox initialQuery={query.q ?? ""} autoFocus={!query.q} />
      </div>
      {query.q ? (
        <Listing query={query} basePath="/search" />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-fg-muted">Popular right now:</p>
          <ul className="flex flex-wrap gap-2" role="list">
            {["Halo One", "earbuds", "charger", "watch", "speaker"].map((t) => (
              <li key={t}>
                <Link
                  href={`/search?q=${encodeURIComponent(t)}`}
                  className="flex h-10 items-center rounded-full border border-line-strong px-4 text-sm hover:border-fg"
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="container-site py-12">
      <h1 className="mb-8 text-display-l">Search</h1>
      <Suspense fallback={<ListingSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
