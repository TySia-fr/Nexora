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
    await expect(page.getByRole("main").getByText(tagline)).toBeVisible();
  });

  test("admin form validation keeps the editor usable", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password, "/admin");
    await page.goto("/admin/products/new");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Check the highlighted fields.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create product" })).toBeEnabled();
  });

  test("inventory: receive stock, count it, and export", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password, "/admin");

    // Receive goods on one variant and see it in its ledger.
    await page.goto("/admin/inventory?q=NX-TAG-BNE");
    await page.getByRole("link", { name: "Trace Tag" }).click();
    await expect(page.getByRole("heading", { name: /Trace Tag/ })).toBeVisible();
    const available = Number(
      await page.getByText("Available", { exact: true }).locator("..").locator("span").nth(1).innerText(),
    );
    await page.getByLabel("Units").fill("6");
    const po = `PO-${Date.now()}`;
    await page.getByLabel("Note").fill(po);
    await page.getByRole("button", { name: "Record movement" }).click();
    await expect(page.getByText("Movement recorded.")).toBeVisible();
    await expect(page.getByRole("cell", { name: new RegExp(po) })).toBeVisible();
    await expect(page.getByText(/^Ledger reconciled/)).toBeVisible();

    // Count the accessories: one shelf has two units fewer than expected.
    await page.goto("/admin/inventory/counts");
    const existing = page.getByText(/is open\. Finish or cancel it/);
    if (await existing.isVisible()) {
      await existing.getByRole("link").click();
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Cancel count" }).click();
      await expect(page.getByText("Count cancelled.")).toBeVisible();
      await page.goto("/admin/inventory/counts");
    }
    await page.getByLabel("Scope").selectOption({ label: "Wearables" });
    await page.getByRole("button", { name: "Start a count" }).click();
    await expect(page.getByRole("heading", { name: /^Count SC-/ })).toBeVisible();
    const row = page.getByRole("row", { name: /NX-TAG-BNE/ });
    const expected = Number(await row.getByRole("cell").nth(1).innerText());
    expect(expected).toBeGreaterThanOrEqual(available + 6);
    await row.getByRole("textbox").fill(String(expected - 2));
    await expect(row.getByRole("cell").nth(3)).toHaveText("-2");
    await page.getByRole("button", { name: "Save progress" }).click();
    await expect(page.getByText("Progress saved.")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Commit count" }).click();
    await expect(page.getByText(/^Committed: 1 correction applied/)).toBeVisible();

    // The CSV reflects it, and is admin-only.
    const csv = await page.request.get("/admin/inventory/export?q=NX-TAG-BNE");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const [, line] = (await csv.text()).trim().split("\r\n");
    expect(line).toContain("NX-TAG-BNE");
    const anonymous = await page.context().browser()!.newContext();
    expect(
      (await anonymous.request.get(`${page.url().split("/admin")[0]}/admin/inventory/export`)).status(),
    ).toBe(401);
    await anonymous.close();
  });
});
