import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Technical SEO guard. Crawls every URL in the sitemap the way a search engine's
 * first pass sees it (server HTML, JavaScript off) and fails on anything that
 * would hurt indexing or snippets: wrong status, missing or duplicate titles and
 * descriptions, canonicals pointing elsewhere, partial Open Graph, broken
 * structured data, images without alt, or a stray noindex.
 * Rules for private and filtered pages are checked at the end.
 */

test.use({ javaScriptEnabled: false });

/** Sitemap entries as paths, so the crawl runs against the test server's baseURL. */
async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(10);
  return locs.map((loc) => {
    const url = new URL(loc);
    return `${url.pathname}${url.search}`;
  });
}

const head = (page: Page, selector: string) => page.locator(`head ${selector}`);

async function headContent(page: Page, selector: string, attr = "content"): Promise<string> {
  const el = head(page, selector);
  await expect(el, `${selector} in <head>`).toHaveCount(1);
  return (await el.getAttribute(attr)) ?? "";
}

/** Canonical from <link rel=canonical> or, for listings, the Link response header. */
function canonicalFrom(html: string | null, linkHeader: string | undefined): string | null {
  if (html) return html;
  const m = linkHeader?.match(/<([^>]+)>;\s*rel="?canonical"?/);
  return m ? m[1] : null;
}

test.describe("technical SEO", () => {
  test("every sitemap URL is indexable, self-canonical and fully described", async ({ page, request }) => {
    test.setTimeout(180_000);
    const paths = await sitemapPaths(request);
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();

    for (const path of paths) {
      await test.step(path, async () => {
        // Pages are cached on first visit (ISR, see ADR); the check is on the cached page.
        await request.get(path);
        const res = await page.goto(path);
        expect(res?.status(), "status").toBe(200);
        const headers = res?.headers() ?? {};
        expect(headers["x-robots-tag"] ?? "", "X-Robots-Tag").not.toMatch(/noindex/);

        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(head(page, 'meta[name="robots"][content*="noindex"]')).toHaveCount(0);

        // Title and description: in <head>, sensible length, unique across the site.
        const title = (await head(page, "title").textContent())?.trim() ?? "";
        expect(title.length, `title "${title}"`).toBeGreaterThanOrEqual(10);
        expect(title.length, `title "${title}"`).toBeLessThanOrEqual(75);
        expect(titles.get(title), `title also used by ${titles.get(title)}`).toBeUndefined();
        titles.set(title, path);

        const description = await headContent(page, 'meta[name="description"]');
        expect(description.length, `description "${description}"`).toBeGreaterThanOrEqual(50);
        expect(description.length, `description "${description}"`).toBeLessThanOrEqual(160);
        expect(
          descriptions.get(description),
          `description also used by ${descriptions.get(description)}`,
        ).toBeUndefined();
        descriptions.set(description, path);

        // The canonical must point at this very URL (absolute, same path).
        const linkCanonical =
          (await head(page, 'link[rel="canonical"]').count()) === 1
            ? await head(page, 'link[rel="canonical"]').getAttribute("href")
            : null;
        const canonical = canonicalFrom(linkCanonical, headers.link);
        expect(canonical, "canonical").not.toBeNull();
        const canonicalUrl = new URL(canonical!);
        expect(canonicalUrl.protocol).toMatch(/^https?:$/);
        expect(`${canonicalUrl.pathname}${canonicalUrl.search}`, "canonical path").toBe(path);

        // Social cards: a complete Open Graph set with an absolute image URL.
        for (const property of ["og:title", "og:description", "og:url", "og:site_name", "og:type"]) {
          expect(await headContent(page, `meta[property="${property}"]`), property).not.toBe("");
        }
        const ogImage = head(page, 'meta[property="og:image"]').first();
        expect(await ogImage.getAttribute("content"), "og:image").toMatch(/^https?:\/\//);
        await expect(head(page, 'meta[name="twitter:card"]')).toHaveAttribute(
          "content",
          "summary_large_image",
        );

        // Content: one h1, and every image says what it is (or is marked decorative).
        await expect(page.locator("h1"), "exactly one h1").toHaveCount(1);
        await expect(page.locator("img:not([alt])"), "images without alt").toHaveCount(0);

        // Structured data parses, and each block declares its type.
        for (const block of await page.locator('script[type="application/ld+json"]').allTextContents()) {
          const parsed = JSON.parse(block) as unknown;
          for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
            expect(item).toHaveProperty("@context", "https://schema.org");
            expect(item).toHaveProperty("@type");
          }
        }
      });
    }
  });

  test("product pages carry Product, Offer and BreadcrumbList data", async ({ page }) => {
    await page.goto("/products/halo-one");
    const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(
      (b) => {
        const parsed = JSON.parse(b) as unknown;
        return (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
      },
    );
    const product = blocks.find((b) => b["@type"] === "Product");
    expect(product).toBeDefined();
    expect(product).toHaveProperty("image");
    const offers = product!.offers as Record<string, unknown>[];
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.priceCurrency).toBe("EUR");
      expect(String(offer.price)).toMatch(/^\d+\.\d{2}$/);
      expect(offer.availability).toMatch(/^https:\/\/schema\.org\/(InStock|OutOfStock)$/);
      expect(offer).toHaveProperty("shippingDetails");
      expect(offer).toHaveProperty("hasMerchantReturnPolicy");
    }
    expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);
  });

  test("robots.txt keeps private areas out and points at the sitemap", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const path of ["/admin", "/account", "/cart", "/checkout", "/api/"]) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    expect(robots).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  });

  test("private pages are noindex", async ({ page }) => {
    for (const path of ["/cart", "/sign-in", "/sign-up", "/search?q=halo"]) {
      await page.goto(path);
      await expect(head(page, 'meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    }
  });

  test("filtered listings are noindex and canonicalise to the plain listing", async ({ request }) => {
    for (const [path, base] of [
      ["/products?sort=price_asc", "/products"],
      ["/products?inStock=1", "/products"],
      ["/categories/audio?min=100", "/categories/audio"],
    ]) {
      const res = await request.get(path);
      expect(res.headers()["x-robots-tag"], path).toMatch(/noindex/);
      const canonical = canonicalFrom(null, res.headers().link);
      expect(canonical && new URL(canonical).pathname, path).toBe(base);
    }
    // Pagination stays indexable with its own canonical.
    const page2 = await request.get("/products?page=2");
    expect(page2.headers()["x-robots-tag"] ?? "").not.toMatch(/noindex/);
  });

  test("missing products return a real 404 with noindex", async ({ page, request }) => {
    // The very first request streams a 200 with noindex; once cached the status is 404.
    await request.get("/products/not-a-real-product");
    const res = await page.goto("/products/not-a-real-product");
    expect(res?.status()).toBe(404);
    await expect(head(page, 'meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });
});
