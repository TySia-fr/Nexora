import { expect, test } from "@playwright/test";
import { addToCart, expectAccessible, expectNotFound } from "./helpers";

test.describe("storefront", () => {
  test("homepage renders real catalog data and is accessible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Silence");
    await expect(page.getByRole("link", { name: /Halo One/ }).first()).toBeVisible();
    await expectAccessible(page);
  });

  test("filters and sorting are driven by the URL", async ({ page }) => {
    await page.goto("/products?category=audio&inStock=1");
    await expect(page.getByText(/products?$/).first()).toBeVisible();
    const names = await page.locator("main ul[role=list] li a span.truncate").allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    await page.getByLabel("Sort").selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    const prices = await page.locator("main ul[role=list] li a span.font-mono").allInnerTexts();
    const values = prices.map((p) => Number(p.replace(/[^\d.]/g, "")));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    await page.getByRole("link", { name: "Clear all" }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("unknown categories, products and paths show the not-found page", async ({ page }) => {
    await page.goto("/categories/nope");
    await expectNotFound(page);
    await page.goto("/products/nope");
    await expectNotFound(page);
    // Unmatched paths get a real 404 status.
    expect((await page.goto("/definitely/not/a/route"))?.status()).toBe(404);
  });

  test("variant selection updates SKU and blocks unavailable options", async ({ page }) => {
    await page.goto("/products/halo-one");
    await page.getByRole("button", { name: /^Signal, out of stock/ }).click();
    await expect(page.getByRole("button", { name: "Unavailable in this option" })).toBeDisabled();
    await expect(page.getByText(/out of stock\. Choose another option/)).toBeVisible();
    await page.getByRole("button", { name: /^Graphite/ }).click();
    await expect(page.getByText("NX-HALO1-GRP")).toBeVisible();
    await expect(page).toHaveURL(/variant=NX-HALO1-GRP/);
    await expectAccessible(page);
  });

  test("purchase journey works with the keyboard only", async ({ page }) => {
    await page.goto("/products/pulse-buds");
    const add = page.getByRole("button", { name: /^Add to cart/ });
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Added to cart/)).toBeVisible();
    await page.getByRole("link", { name: "View cart" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/cart$/);
    await page.getByRole("link", { name: "Checkout" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("search suggestions support arrow keys", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("combobox").fill("pul");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/products\/pulse-buds/);
  });

  test("mobile menu opens, traps focus on close button and closes with Escape @mobile-only", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    // The menu must cover the whole viewport, not render inside the header box
    // (a backdrop-filter on an ancestor turns position: fixed into position: absolute).
    // Measured once the entrance animation has settled.
    const viewport = page.viewportSize()!;
    await expect(async () => {
      const box = (await dialog.boundingBox())!;
      expect([box.x, box.y, Math.round(box.width), Math.round(box.height)]).toEqual([
        0,
        0,
        viewport.width,
        viewport.height,
      ]);
    }).toPass({ timeout: 2000 });
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("cart: quantities, coupons and server totals @mobile", async ({ page }) => {
    await addToCart(page, "flux-65w");
    await page.goto("/cart");
    await page.getByLabel(/Quantity for Flux 65W/).selectOption("2");
    await expect(page.locator("aside dd").first()).toHaveText("€118.00");
    await page.getByLabel("Discount code").fill("SUMMER25");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("This code has expired.")).toBeVisible();
    await page.getByLabel("Discount code").fill("NEXORA10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Discount (NEXORA10)")).toBeVisible();
    // 118.00 − 11.80 = 106.20, free shipping (≥ €99).
    await expect(page.getByText("€106.20")).toBeVisible();
    await expectAccessible(page);
  });
});
