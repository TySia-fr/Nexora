import { chromium } from "@playwright/test";
const dir = process.argv[2];
const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  args: ["--disable-background-networking", "--no-first-run"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const out = {};
await page.goto("http://localhost:3000/admin");
await page.waitForURL(/sign-in/);
out.anonRedirect = page.url();
await page.getByLabel("Email").fill("admin@nexora.test");
await page.getByLabel("Password").fill("admin-local-only-123");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("http://localhost:3000/admin");
await page.getByRole("heading", { name: "Dashboard" }).waitFor();
await page.screenshot({ path: `${dir}/admin-dash.png` });
await page.goto("http://localhost:3000/admin/products?q=halo", { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Halo One", exact: true }).click();
await page.getByRole("heading", { name: "Halo One" }).waitFor();
await page.getByLabel("Variant 2 stock change, for example 10 or -2").fill("5");
await page.getByRole("button", { name: "Apply" }).nth(1).click();
await page.getByLabel("Variant 2 current stock").getByText("8").waitFor();
await page.getByLabel("Tagline").fill("Over-ear headphones, adaptive ANC");
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText("Saved. The storefront").waitFor();
await page.screenshot({ path: `${dir}/admin-product.png`, fullPage: true });
await page.goto("http://localhost:3000/products/halo-one", { waitUntil: "networkidle" });
out.storeTagline = await page.locator("main span.label-mono").first().innerText();
out.boneStock = await page
  .getByText(/In stock/)
  .first()
  .innerText();
await page.goto("http://localhost:3000/admin/coupons", { waitUntil: "networkidle" });
await page.getByLabel("Code").fill("QA5");
await page.getByLabel("Value (% or €)").fill("500");
await page.getByRole("button", { name: "Create coupon" }).click();
await page.getByText("Percent must be a whole number").waitFor();
out.keptCode = await page.getByLabel("Code").inputValue();
await page.getByLabel("Value (% or €)").fill("5");
await page.getByRole("button", { name: "Create coupon" }).click();
await page.getByText("Coupon created.").waitFor();
await page.goto("http://localhost:3000/admin/orders", { waitUntil: "networkidle" });
out.orderRows = await page.locator("tbody tr").count();
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
