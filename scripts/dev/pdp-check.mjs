import { chromium } from "@playwright/test";
const out = process.argv[2];
const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:3000/products/halo-one", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Signal, out of stock/ }).click();
const disabled = await page.getByRole("button", { name: /Unavailable in this option/ }).isDisabled();
await page.getByRole("button", { name: /^Bone/ }).click();
await page.getByRole("button", { name: "Increase quantity" }).click();
await page.getByRole("button", { name: /Add to cart/ }).click();
await page.getByText(/Added to cart/).waitFor({ timeout: 15000 });
const status = await page.getByRole("status").first().innerText();
await page.waitForTimeout(500);
const cartLabel = await page.getByRole("link", { name: /^Cart,/ }).getAttribute("aria-label");
await page.screenshot({ path: out });
console.log(JSON.stringify({ disabled, status, cartLabel, url: page.url(), errors }));
await browser.close();
