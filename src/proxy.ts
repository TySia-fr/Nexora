import { NextResponse, type NextRequest } from "next/server";
import { listingIndexing } from "@/lib/seo";
import { parseListingQuery } from "@/lib/validation/catalog";

/**
 * Indexing signals for listing pages, sent as HTTP headers.
 *
 * Whether a listing URL is indexable depends on its query string (filters, sort,
 * page). Reading searchParams in generateMetadata would make the page's metadata
 * request-time, so it would stream into <body> instead of <head>. Search engines
 * honour `Link: rel="canonical"` and `X-Robots-Tag` headers, and the proxy can
 * compute them from the URL alone, so the page metadata stays static.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const category = pathname.match(/^\/categories\/([a-z0-9-]{1,60})$/)?.[1];
  if (pathname !== "/products" && !category) return NextResponse.next();

  const query = parseListingQuery(Object.fromEntries(searchParams));
  const { canonical, index } = listingIndexing(pathname, query, category);
  const origin = process.env.APP_URL ?? request.nextUrl.origin;

  const response = NextResponse.next();
  response.headers.set("Link", `<${new URL(canonical, origin)}>; rel="canonical"`);
  if (!index) response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}

export const config = {
  matcher: ["/products", "/categories/:slug"],
};
