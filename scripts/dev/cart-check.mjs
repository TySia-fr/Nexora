import { chromium } from "@playwright/test";
const dir = process.argv[2];
const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  args: ["--disable-background-networking", "--no-first-run"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:3000/products/flux-65w", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Add to cart/ }).click();
await page.getByText(/Added to cart/).waitFor();
await page.goto("http://localhost:3000/products/pulse-buds", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Add to cart/ }).click();
await page.getByText(/Added to cart/).waitFor();
await page.goto("http://localhost:3000/cart", { waitUntil: "networkidle" });
await page.getByLabel("Discount code").fill("SUMMER25");
await page.getByRole("button", { name: "Apply" }).click();
await page.getByText(/expired/).waitFor();
const expired = await page.getByText(/expired/).innerText();
await page.getByLabel("Discount code").fill("nexora10");
await page.getByRole("button", { name: "Apply" }).click();
await page.getByText(/Discount \(NEXORA10\)/).waitFor();
await page.getByLabel(/Quantity for Pulse Buds/).selectOption("2");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
const total = await page.locator("dd").last().innerText();
await page.screenshot({ path: `${dir}/cart.png` });
await page.getByRole("link", { name: "Checkout" }).click();
await page.waitForURL(/checkout/);
await page.getByLabel("Postal code").fill("97100");
await page.getByLabel("Email").fill("nope");
const disabled = await page.getByRole("button", { name: /Payments unavailable/ }).isDisabled();
await page.screenshot({ path: `${dir}/checkout.png`, fullPage: true });
console.log(JSON.stringify({ expired, total, disabled, errors }));
await browser.close();
