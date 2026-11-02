import { describe, expect, it } from "vitest";
import { breadcrumbLd, listingIndexing, offerPolicies, websiteLd } from "./seo";

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
