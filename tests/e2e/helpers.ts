import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** The admin created with `pnpm admin:create` for this test run. No default password lives in the repo. */
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};

export async function signIn(page: Page, email: string, password: string, next = "/account") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
}

export async function signUp(page: Page, next = "/account") {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const password = "e2e-password-123";
  await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Name").fill("E2E Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === next);
  return { email, password };
}

/**
 * WCAG 2.1 A/AA checks; fails on serious or critical violations.
 * Entrance animations are allowed to finish first: axe measures contrast with the
 * current opacity, so scanning mid-fade would report colours the page never settles on.
 * Infinite animations (loading skeletons) are not awaited.
 */
export async function expectAccessible(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function addToCart(page: Page, slug: string) {
  await page.goto(`/products/${slug}`);
  await page.getByRole("button", { name: /^Add to cart/ }).click();
  await expect(page.getByText(/Added to cart/)).toBeVisible();
}

/**
 * With streaming, a notFound() raised after the page shell has been sent can't
 * change the HTTP status, so Next marks the page noindex instead ("soft 404").
 * This checks what users and crawlers actually get.
 */
export async function expectNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: "This page isn't here." })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
}
