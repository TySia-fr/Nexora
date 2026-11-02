import { describe, expect, it } from "vitest";
import {
  breadcrumbLd,
  clampDescription,
  DEFAULT_OG_IMAGE,
  DESCRIPTION_MAX,
  listingIndexing,
  offerPolicies,
  pageMetadata,
  websiteLd,
} from "./seo";

const base = {
  q: undefined,
  min: undefined,
  max: undefined,
  inStock: undefined,
  sort: "newest" as const,
  page: 1,
};

describe("listingIndexing", () => {
  it("indexes the plain listing with a self canonical", () => {
    expect(listingIndexing("/products", base)).toEqual({ canonical: "/products", index: true });
  });

  it("keeps pagination indexable and self-canonical", () => {
    expect(listingIndexing("/products", { ...base, page: 3 })).toEqual({
      canonical: "/products?page=3",
      index: true,
    });
  });

  it.each([
    ["search", { q: "buds" }],
    ["price", { min: 50 }],
    ["stock", { inStock: true as const }],
    ["sort", { sort: "price_asc" as const }],
    ["category on /products", { category: "audio" }],
  ])("noindexes %s filters and points at the base page", (_, extra) => {
    expect(listingIndexing("/products", { ...base, page: 2, ...extra })).toEqual({
      canonical: "/products",
      index: false,
    });
  });

  it("treats a category page's own category as unfiltered", () => {
    expect(listingIndexing("/categories/audio", { ...base, category: "audio" }, "audio").index).toBe(true);
  });
});

describe("structured data", () => {
  it("numbers breadcrumbs from 1 with absolute URLs", () => {
    const ld = breadcrumbLd("https://shop.test", [
      { name: "Home", path: "/" },
      { name: "Audio", path: "/categories/audio" },
    ]);
    expect(ld.itemListElement.map((i) => [i.position, i.item])).toEqual([
      [1, "https://shop.test/"],
      [2, "https://shop.test/categories/audio"],
    ]);
  });

  it("uses the checkout's free-shipping threshold", () => {
    expect(offerPolicies("https://shop.test", 9900).shippingDetails.shippingRate.value).toBe("0.00");
    expect(offerPolicies("https://shop.test", 9899).shippingDetails.shippingRate.value).toBe("6.90");
  });

  it("declares a search action that matches the search route", () => {
    expect(websiteLd("https://shop.test").potentialAction.target.urlTemplate).toBe(
      "https://shop.test/search?q={search_term_string}",
    );
  });
});

describe("clampDescription", () => {
  it("leaves short text alone, normalising whitespace", () => {
    expect(clampDescription("  Quiet   by design. ")).toBe("Quiet by design.");
  });

  it("cuts long text on a word boundary within the limit", () => {
    const text = `${"Precision audio ".repeat(15)}end`;
    const out = clampDescription(text);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    expect(text.startsWith(out.slice(0, -1))).toBe(true);
  });
});

describe("pageMetadata", () => {
  it("builds a complete Open Graph and Twitter set with the shared image", () => {
    const m = pageMetadata({ title: "Returns", description: "Thirty days.", path: "/returns" });
    expect(m.title).toBe("Returns");
    expect(m.alternates).toEqual({ canonical: "/returns" });
    expect(m.openGraph).toMatchObject({
      siteName: "NEXORA",
      locale: "en_IE",
      url: "/returns",
      title: "Returns · NEXORA",
      description: "Thirty days.",
      images: [DEFAULT_OG_IMAGE],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] });
  });

  it("leaves the canonical to the proxy for listings and keeps absolute titles", () => {
    const m = pageMetadata({
      title: "NEXORA — Home",
      absoluteTitle: true,
      description: "x",
      path: "/products",
      canonical: false,
    });
    expect(m.alternates).toBeUndefined();
    expect(m.title).toEqual({ absolute: "NEXORA — Home" });
    expect(m.openGraph?.title).toBe("NEXORA — Home");
  });

  it("uses the page's own image when it has one", () => {
    const image = { url: "/products/halo.webp", width: 1600, height: 1600, alt: "Halo One" };
    const m = pageMetadata({ title: "Halo One", description: "x", path: "/products/halo-one", image });
    expect(m.openGraph?.images).toEqual([image]);
  });
});
