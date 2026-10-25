/**
 * Renders the product images in public/products/ (and the editorial shots in public/brand/)
 * from procedural 3D models, in headless Chromium with three.js.
 *
 *   PLAYWRIGHT_CHROMIUM_PATH=… pnpm render:products            # everything
 *   pnpm render:products -- --only halo-one,monolith           # some products
 *   pnpm render:products -- --brand                            # editorial shots + social card
 *   pnpm render:products -- --og                               # social card only
 *
 * The models are original (see scripts/render/models.js): no photos, no third-party assets.
 * File names are stable, so re-rendering never requires a database change.
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { imageFileName, products } from "../../prisma/seed-data";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "products");
const BRAND = join(ROOT, "public", "brand");
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
};

type Shot = {
  file: string;
  dir: string;
  width: number;
  height?: number;
  spec: Record<string, unknown>;
};

/** Editorial shots for the homepage. Same models, composed for a layout rather than a grid. */
const brandShots: Shot[] = [
  {
    // Hero: graphite Halo One on a pale concrete set with a raking light edge.
    file: "hero-halo-one.webp",
    dir: BRAND,
    width: 1600,
    height: 1800,
    spec: {
      slug: "halo-one",
      shape: "headphones",
      color: "#2A2A2F",
      set: "light",
      yaw: -34,
      pitch: 9,
      fill: 0.62,
      offsetY: -0.12,
      edge: 24,
      size: [1800, 2025],
    },
  },
  {
    // Object study for the featured section; transparent, with callout anchors.
    file: "halo-one-side.webp",
    dir: BRAND,
    width: 1600,
    height: 1200,
    spec: {
      slug: "halo-one",
      shape: "headphones",
      color: "#D9D8D2",
      yaw: 58,
      pitch: 8,
      fill: 0.78,
      size: [2000, 1500],
    },
  },
  {
    // Full-width campaign: Monolith in Bone on a dark set, placed in the right third.
    file: "monolith-campaign.webp",
    dir: BRAND,
    width: 2400,
    height: 1200,
    spec: {
      slug: "monolith",
      shape: "speaker-column",
      color: "#D9D8D2",
      set: "dark",
      yaw: -22,
      pitch: 5,
      fill: 0.7,
      fillX: 0.3,
      offsetX: 0.42,
      offsetY: -0.08,
      edge: 32,
      wallDistance: 1.6,
      size: [2400, 1200],
    },
  },
];

function productShots(only?: Set<string>): Shot[] {
  const shots: Shot[] = [];
  for (const p of products) {
    if (only && !only.has(p.slug)) continue;
    const primary = p.variants[0]!.colorHex ?? "#2A2A2F";
    const add = (sku: string | null, color: string) => {
      for (const view of ["front", "detail"] as const) {
        shots.push({
          file: imageFileName(p.slug, sku, view),
          dir: OUT,
          width: 1200,
          spec: { slug: p.slug, shape: p.shape, color, view, size: [2048, 2048] },
        });
      }
    };
    add(null, primary);
    if (new Set(p.variants.map((v) => v.colorHex)).size > 1) {
      for (const v of p.variants) add(v.sku, v.colorHex ?? primary);
    }
  }
  return shots;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only"));
  const only = onlyArg
    ? new Set((onlyArg.split("=")[1] ?? args[args.indexOf(onlyArg) + 1] ?? "").split(","))
    : undefined;
  const brandOnly = args.includes("--brand");
  const ogOnly = args.includes("--og");
  // --preview=DIR: quick low-resolution PNGs for checking models, nothing written to public/.
  const previewArg = args.find((a) => a.startsWith("--preview="));
  const preview = previewArg?.split("=")[1];
  const shots = ogOnly ? [] : brandOnly ? brandShots : [...productShots(only), ...(only ? [] : brandShots)];

  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
    const allowed = [
      "/scripts/render/",
      "/node_modules/three/",
      "/node_modules/@fontsource-variable/",
      "/public/brand/",
    ];
    if (!allowed.some((prefix) => path.startsWith(prefix))) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("studio:", e.message));
  await page.goto(`http://127.0.0.1:${port}/scripts/render/studio.html`);
  await page.waitForFunction(() => (window as unknown as { studioReady?: boolean }).studioReady, null, {
    timeout: 60_000,
  });

  await mkdir(OUT, { recursive: true });
  await mkdir(BRAND, { recursive: true });
  const anchors: Record<string, Record<string, [number, number]>> = {};
  for (const shot of shots) {
    const spec = preview
      ? { ...shot.spec, size: (shot.spec.size as number[]).map((n) => Math.round(n / 2.5)), preview: true }
      : shot.spec;
    const result = await page.evaluate(
      (s) =>
        (
          window as unknown as {
            renderShot: (s: unknown) => { url: string; anchors: Record<string, [number, number]> };
          }
        ).renderShot(s),
      spec,
    );
    if (shot.dir === BRAND && Object.keys(result.anchors).length) anchors[shot.file] = result.anchors;
    const png = Buffer.from(result.url.split(",")[1]!, "base64");
    if (preview) {
      await mkdir(preview, { recursive: true });
      await sharp(png).toFile(join(preview, shot.file.replace(".webp", ".png")));
      console.log("preview", shot.file);
      continue;
    }
    await sharp(png)
      .resize(shot.width, shot.height ?? shot.width, { kernel: "lanczos3" })
      .webp({ quality: 84, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toFile(join(shot.dir, shot.file));
    console.log("rendered", shot.file);
  }
  if (!preview && Object.keys(anchors).length) {
    // Callout positions (percent of frame) consumed by the homepage.
    await writeFile(join(BRAND, "anchors.json"), `${JSON.stringify(anchors, null, 2)}\n`);
  }
  if (!preview && (ogOnly || brandOnly || !only)) {
    // Social card, laid out in HTML with the real fonts and the fresh hero render.
    const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await og.goto(`http://127.0.0.1:${port}/scripts/render/og.html`, { waitUntil: "networkidle" });
    await og.evaluate(() => document.fonts.ready);
    const card = await og.screenshot({ type: "png" });
    await sharp(card).jpeg({ quality: 86, mozjpeg: true }).toFile(join(BRAND, "og.jpg"));
    console.log("rendered og.jpg");
  }
  await browser.close();
  server.close();
  console.log(`${shots.length} images`);
}

await main();
