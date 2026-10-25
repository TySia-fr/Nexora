import { expect, test } from "@playwright/test";
import { addToCart } from "./helpers";

test.describe("checkout", () => {
  test("an empty cart can't reach checkout", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("checkout shows server totals and is honest when payments are off", async ({ page }) => {
    test.skip(Boolean(process.env.STRIPE_SECRET_KEY), "payments are configured in this environment");
    await addToCart(page, "pebble");
    await page.goto("/checkout");
    await expect(page.getByText("€89.00").first()).toBeVisible();
    // Below €99: standard shipping is charged.
    await expect(page.getByText("€95.90")).toBeVisible();
    await page.getByLabel(/Express/).check();
    await expect(page.getByText("€101.90")).toBeVisible();
    await expect(page.getByRole("button", { name: "Payments unavailable" })).toBeDisabled();
    await expect(page.getByText(/Payments aren.t configured/)).toBeVisible();
  });

  test("the success page never marks an order paid on its own", async ({ page }) => {
    await page.goto("/checkout/success?session_id=cs_test_doesnotexist123");
    await expect(page.getByText("We couldn't find that order.")).toBeVisible();
  });

  test("webhook rejects unsigned requests", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", {
      data: { id: "evt_fake", type: "checkout.session.completed" },
    });
    expect([400, 503]).toContain(r.status());
  });
});
