/**
 * Search-engine helpers: indexing rules for listing URLs and schema.org builders.
 * Pure functions (no I/O), so the rules are unit-tested in seo.test.ts.
 */
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/lib/pricing";
import type { ListingQuery } from "@/lib/validation/catalog";

export const SITE_NAME = "NEXORA";

/** Returns window in days, as stated on /returns. */
export const RETURN_DAYS = 30;

export function absoluteUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

/**
 * Filtered and sorted listings are near-duplicates of the base listing: they are
 * crawlable (links are followed) but not indexed, and point their canonical at the
 * unfiltered page. Plain pagination stays indexable with a self-referencing canonical.
 */
export function listingIndexing(
  basePath: string,
  query: Pick<ListingQuery, "q" | "min" | "max" | "inStock" | "sort" | "page"> & { category?: string },
  lockedCategory?: string,
): { canonical: string; index: boolean } {
  const filtered =
    Boolean(query.q) ||
    query.min !== undefined ||
    query.max !== undefined ||
    Boolean(query.inStock) ||
    (query.category !== undefined && query.category !== lockedCategory) ||
    query.sort !== "newest";
  if (filtered) return { canonical: basePath, index: false };
  return { canonical: query.page > 1 ? `${basePath}?page=${query.page}` : basePath, index: true };
}

type Crumb = { name: string; path: string };

export function breadcrumbLd(base: string, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(base, c.path),
    })),
  };
}

export function organizationLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(base, "/#organization"),
    name: SITE_NAME,
    url: absoluteUrl(base, "/"),
    logo: absoluteUrl(base, "/brand/logo.png"),
    description: "A fictional consumer electronics brand, built as a full-stack portfolio project.",
  };
}

export function websiteLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl(base, "/#website"),
    name: SITE_NAME,
    url: absoluteUrl(base, "/"),
    publisher: { "@id": absoluteUrl(base, "/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl(base, "/search?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Shipping and returns as schema.org offer details. Built from the same constants the
 * checkout uses, so the structured data can't drift from what customers are charged.
 */
export function offerPolicies(base: string, priceCents: number) {
  const standardRate = priceCents >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_RATES.STANDARD;
  return {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: (standardRate / 100).toFixed(2), currency: "EUR" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "FR" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 4, unitCode: "DAY" },
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "FR",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: RETURN_DAYS,
      returnMethod: "https://schema.org/ReturnByMail",
      url: absoluteUrl(base, "/returns"),
    },
  };
}
