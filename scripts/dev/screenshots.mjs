// Regenerates docs/screenshots from a running build: node scripts/dev/screenshots.mjs
import { chromium } from "@playwright/test";
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ["--disable-background-networking", "--no-first-run"],
});
async function shot(name, path, viewport, prepare) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  if (prepare) await prepare(page);
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await page.close();
}
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
await shot("home", "/", desktop);
await shot("product", "/products/halo-one?variant=NX-HALO1-BNE", desktop);
await shot("listing", "/products?category=audio&sort=price_desc", desktop);
await shot("home-mobile", "/", phone);
await shot("product-mobile", "/products/orbit-watch", phone);
await shot("cart", "/cart", desktop, async (page) => {
  await page.goto(base + "/products/pulse-buds");
  await page.getByRole("button", { name: /^Add to cart/ }).click();
  await page.getByText(/Added to cart/).waitFor();
  await page.goto(base + "/products/flux-65w");
  await page.getByRole("button", { name: /^Add to cart/ }).click();
  await page.getByText(/Added to cart/).waitFor();
});
await shot("admin", "/admin", desktop, async (page) => {
  await page.goto(base + "/sign-in?next=/admin");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL ?? "admin@nexora.test");
  await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "admin-local-only-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(base + "/admin");
});
await browser.close();
console.log("done");
