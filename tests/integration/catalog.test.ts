import { beforeAll, describe, expect, it } from "vitest";
import { getProductBySlug, listProducts, searchSuggestions } from "@/server/catalog";
import { parseListingQuery } from "@/lib/validation/catalog";
import { makeCategory, makeProduct, resetDatabase } from "./helpers";

const q = (raw: Record<string, string>) => parseListingQuery(raw);

describe("catalog listing", () => {
  let audioSlug: string;

  beforeAll(async () => {
    await resetDatabase();
    const audio = await makeCategory("audio");
    const phones = await makeCategory("phones");
    audioSlug = audio.slug;
    await makeProduct({ categoryId: audio.id, name: "Halo One", unitsSold: 50, createdAt: new Date("2026-10-01"), variants: [{ priceCents: 34900, stock: 0 }, { priceCents: 34900, stock: 3 }] });
    await makeProduct({ categoryId: audio.id, name: "Pulse Buds", unitsSold: 90, createdAt: new Date("2026-09-01"), variants: [{ priceCents: 17900, stock: 5 }] });
    await makeProduct({ categoryId: audio.id, name: "Sold Out Buds", unitsSold: 1, createdAt: new Date("2026-08-01"), variants: [{ priceCents: 9900, stock: 0 }] });
    await makeProduct({ categoryId: phones.id, name: "Axis 2", unitsSold: 10, createdAt: new Date("2026-10-10"), variants: [{ priceCents: 79900, stock: 2 }, { priceCents: 89900, stock: 0 }] });
    await makeProduct({ categoryId: phones.id, name: "Draft Phone", status: "DRAFT" });
    await makeProduct({ categoryId: phones.id, name: "100% Phone_X", variants: [{ priceCents: 5000, stock: 1, isActive: false }] });
  });

  it("lists only active products with at least one active variant, newest first", async () => {
    const r = await listProducts(q({}));
    expect(r.products.map((p) => p.name)).toEqual(["Axis 2", "Halo One", "Pulse Buds", "Sold Out Buds"]);
    expect(r.total).toBe(4);
  });

  it("filters by category", async () => {
    const r = await listProducts(q({ category: audioSlug }));
    expect(r.products.every((p) => p.categorySlug === audioSlug)).toBe(true);
    expect(r.total).toBe(3);
  });

  it("returns nothing for an unknown category instead of failing", async () => {
    expect((await listProducts(q({ category: "does-not-exist" }))).total).toBe(0);
    // Invalid slugs are dropped by the parser.
    expect(q({ category: "../../etc" }).category).toBeUndefined();
  });

  it("filters by price range using the lowest variant price", async () => {
    const r = await listProducts(q({ min: "100", max: "400" }));
    expect(r.products.map((p) => p.name).sort()).toEqual(["Halo One", "Pulse Buds"]);
  });

  it("swaps an inverted price range", () => {
    expect(q({ min: "400", max: "100" })).toMatchObject({ min: 100, max: 400 });
  });

  it("filters to in-stock products", async () => {
    const r = await listProducts(q({ inStock: "1" }));
    expect(r.products.map((p) => p.name)).not.toContain("Sold Out Buds");
    expect(r.products.every((p) => p.inStock)).toBe(true);
  });

  it.each([
    ["price_asc", ["Sold Out Buds", "Pulse Buds", "Halo One", "Axis 2"]],
    ["price_desc", ["Axis 2", "Halo One", "Pulse Buds", "Sold Out Buds"]],
    ["popular", ["Pulse Buds", "Halo One", "Axis 2", "Sold Out Buds"]],
  ])("sorts by %s", async (sort, expected) => {
    expect((await listProducts(q({ sort }))).products.map((p) => p.name)).toEqual(expected);
  });

  it("searches names and categories, treating wildcards literally", async () => {
    expect((await listProducts(q({ q: "pulse" }))).products.map((p) => p.name)).toEqual(["Pulse Buds"]);
    expect((await listProducts(q({ q: "phones" }))).products.map((p) => p.name)).toEqual(["Axis 2"]);
    expect((await listProducts(q({ q: "%" }))).total).toBe(0);
    expect((await listProducts(q({ q: "_" }))).total).toBe(0);
  });

  it("reports price ranges and stock on cards", async () => {
    const axis = (await listProducts(q({ q: "axis" }))).products[0]!;
    expect(axis).toMatchObject({ priceFromCents: 79900, hasPriceRange: true, inStock: true });
  });

  it("paginates and survives an out-of-range page", async () => {
    const r = await listProducts(q({ page: "99" }));
    expect(r.products).toEqual([]);
    expect(r.total).toBe(4);
    expect(r.pageCount).toBe(1);
  });

  it("does not expose draft products by slug", async () => {
    const r = await listProducts(q({}));
    expect(await getProductBySlug(r.products[0]!.slug)).not.toBeNull();
    expect(await getProductBySlug("draft-phone-5")).toBeNull();
  });

  it("suggests active products, name prefix matches first", async () => {
    const s = await searchSuggestions("so");
    expect(s.map((x) => x.name)).toEqual(["Sold Out Buds"]);
    const buds = await searchSuggestions("buds");
    expect(buds.map((x) => x.name).sort()).toEqual(["Pulse Buds", "Sold Out Buds"]);
    expect(await searchSuggestions("x")).toEqual([]); // too short
  });
});
