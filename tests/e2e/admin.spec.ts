import { expect, test } from "@playwright/test";
import { ADMIN, signIn, signUp } from "./helpers";

test.describe("admin", () => {
  test.skip(!ADMIN.email || !ADMIN.password, "set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  test("customers are turned away from admin pages", async ({ page }) => {
    await signUp(page, "/account");
    await page.goto("/admin/products");
    await expect(page).toHaveURL("/");
  });

  test("admin can review the dashboard, edit a product and see it in the store", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password, "/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto("/admin/products?q=Trace");
    await page.getByRole("link", { name: "Trace Tag", exact: true }).click();
    const tagline = `Item tracker ${Date.now()}`;
    await page.getByLabel("Tagline").fill(tagline);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    await page.goto("/products/trace-tag");
    await expect(page.getByText(tagline)).toBeVisible();
  });

  test("admin form validation keeps the editor usable", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password, "/admin");
    await page.goto("/admin/products/new");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Check the highlighted fields.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create product" })).toBeEnabled();
  });
});
