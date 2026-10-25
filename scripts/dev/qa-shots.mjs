// Full-page QA screenshots at several widths, with scroll reveals triggered.
//   node scripts/dev/qa-shots.mjs /out/dir /path [widths...]
import { chromium } from "@playwright/test";
const [out = "/tmp/qa", path = "/", ...ws] = process.argv.slice(2);
const widths = ws.length ? ws.map(Number) : [390, 1440];
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const errors = [];
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && errors.push(`${w}: ${m.text()}`));
  if (process.env.QA_VERBOSE) page.on("console", (m) => m.type() === "error" && console.log(m.text()));
  page.on("pageerror", (e) => errors.push(`${w}: ${e.message}`));
  await page.goto(base + path, { waitUntil: "networkidle" });
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) errors.push(`${w}: horizontal overflow ${overflow}px`);
  const name = path.replace(/[^a-z0-9]+/gi, "_") || "home";
  await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no console errors, no overflow");
