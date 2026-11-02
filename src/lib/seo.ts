/**
 * Search-engine helpers: indexing rules for listing URLs and schema.org builders.
 * Pure functions (no I/O), so the rules are unit-tested in seo.test.ts.
 */
import type { Metadata } from "next";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_RATES } from "@/lib/pricing";
import type { ListingQuery } from "@/lib/validation/catalog";

export const SITE_NAME = "NEXORA";

/** Returns window in days, as stated on /returns. */
export const RETURN_DAYS = 30;

/** Shared card for pages without an image of their own (1200×630 JPEG). */
export const DEFAULT_OG_IMAGE = {
  url: "/brand/og.jpg",
  width: 1200,
  height: 630,
  alt: "NEXORA — Precision electronics",
};

/** Google shows about 155–160 characters of a description. */
export const DESCRIPTION_MAX = 160;

/** Shortens text to `max` characters on a word boundary, with an ellipsis. */
export function clampDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:–—-]+$/, "")}…`;
}

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * The metadata of every public page, built in one place.
 *
 * Next.js merges metadata shallowly: a page that sets `openGraph` replaces the root
 * layout's object entirely, so its site name, locale and image silently disappear.
 * Building the whole object here means every page ships the same complete set:
 * title, description, Open Graph (url, type, site name, locale, image) and Twitter.
 *
 * `canonical: false` is for listings, whose canonical depends on the query string and
 * is sent as a header by src/proxy.ts instead.
 */
export function pageMetadata(opts: {
  title: string;
  /** Use the title as is, without the "· NEXORA" template. */
  absoluteTitle?: boolean;
  description: string;
  path: string;
  canonical?: boolean;
  image?: OgImage;
  type?: "website" | "article";
}): Metadata {
  const description = clampDescription(opts.description);
  const socialTitle = opts.absoluteTitle ? opts.title : `${opts.title} · ${SITE_NAME}`;
  const image = opts.image ?? DEFAULT_OG_IMAGE;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description,
    ...(opts.canonical === false ? {} : { alternates: { canonical: opts.path } }),
    openGraph: {
      type: opts.type ?? "website",
      siteName: SITE_NAME,
      locale: "en_IE",
      url: opts.path,
      title: socialTitle,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [image.url] },
  };
}

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
