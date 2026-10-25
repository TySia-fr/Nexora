import { expect, test } from "@playwright/test";
import pg from "pg";
import { addToCart, expectAccessible, expectNotFound, signIn, signUp } from "./helpers";

test.describe("accounts", () => {
  test("protected pages require sign-in", async ({ page }) => {
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Forders/);
  });

  test("sign-up, guest cart merge, sign-out, generic error on wrong password", async ({ page }) => {
    await addToCart(page, "trace-tag");
    const user = await signUp(page, "/account");
    await expect(page.getByRole("heading", { name: /Hello, E2E/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Cart, 1 item/ })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    // Same message for an address that has no account.
    await page.getByLabel("Email").fill("nobody-here@example.test");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

    await signIn(page, user.email, user.password, "/account/wishlist");
  });

  test("post-login redirects stay on this site", async ({ page }) => {
    const user = await signUp(page, "/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.goto("/sign-in?next=https://evil.example/steal");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/account");
  });

  test("a customer can't open someone else's order", async ({ page }) => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM "Order" WHERE "userId" IS NOT NULL LIMIT 1`,
    );
    await client.end();
    test.skip(rows.length === 0, "no seeded orders");
    await signUp(page, "/account");
    await page.goto(`/account/orders/${rows[0]!.id}`);
    await expectNotFound(page);
    await expect(page.getByRole("heading", { name: /^Order NX-/ })).toHaveCount(0);
  });
});
