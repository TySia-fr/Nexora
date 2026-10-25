/**
 * Generates the product images in public/products/ from prisma/seed-data.ts.
 *
 * The renders are original vector compositions (no third-party assets), so
 * they are safe to publish and can never disappear from a CDN. Each product
 * gets a "front" image per variant and a "detail" crop.
 *
 *   pnpm tsx scripts/generate-product-art.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { products, type ArtShape } from "../prisma/seed-data";

const SIZE = 1200;
const OUT = join(process.cwd(), "public", "products");
const BG = "#141416";

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Mixes a hex colour towards white (amt > 0) or black (amt < 0). */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = amt > 0 ? 255 : 0;
  const t = Math.abs(amt);
  const mix = (c: number) => clamp(c + (target - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

/** Shapes drawn in a 1000×1000 box centred on (500, 500). */
function shape(kind: ArtShape, c: string): string {
  const edge = isLight(c) ? shade(c, -0.25) : shade(c, 0.22);
  const deep = shade(c, -0.35);
  const hi = shade(c, 0.35);
  const accent = "#C8F135";
  switch (kind) {
    case "headphones":
      return `
        <path d="M250 560 C250 230 750 230 750 560" fill="none" stroke="${edge}" stroke-width="46" stroke-linecap="round"/>
        <path d="M250 560 C250 230 750 230 750 560" fill="none" stroke="${c}" stroke-width="34" stroke-linecap="round"/>
        <rect x="180" y="500" width="170" height="290" rx="78" fill="${c}" stroke="${edge}" stroke-width="6"/>
        <rect x="650" y="500" width="170" height="290" rx="78" fill="${c}" stroke="${edge}" stroke-width="6"/>
        <rect x="218" y="545" width="94" height="200" rx="46" fill="${deep}"/>
        <rect x="688" y="545" width="94" height="200" rx="46" fill="${deep}"/>
        <circle cx="770" cy="560" r="8" fill="${accent}"/>`;
    case "earbuds":
      return `
        <rect x="300" y="420" width="400" height="300" rx="140" fill="${c}" stroke="${edge}" stroke-width="6"/>
        <line x1="310" y1="545" x2="690" y2="545" stroke="${edge}" stroke-width="4"/>
        <circle cx="400" cy="400" r="90" fill="${c}" stroke="${edge}" stroke-width="6"/>
        <circle cx="600" cy="400" r="90" fill="${c}" stroke="${edge}" stroke-width="6"/>
        <circle cx="400" cy="400" r="40" fill="${deep}"/>
        <circle cx="600" cy="400" r="40" fill="${deep}"/>
        <circle cx="500" cy="640" r="7" fill="${accent}"/>`;
    case "watch":
      return `
        <rect x="410" y="170" width="180" height="230" rx="30" fill="${deep}"/>
        <rect x="410" y="600" width="180" height="230" rx="30" fill="${deep}"/>
        <circle cx="500" cy="500" r="190" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <circle cx="500" cy="500" r="150" fill="#0B0B0C"/>
        <line x1="500" y1="500" x2="500" y2="410" stroke="#EDEDEA" stroke-width="8" stroke-linecap="round"/>
        <line x1="500" y1="500" x2="565" y2="530" stroke="#EDEDEA" stroke-width="6" stroke-linecap="round"/>
        <circle cx="500" cy="500" r="9" fill="${accent}"/>
        <rect x="688" y="470" width="26" height="60" rx="10" fill="${edge}"/>`;
    case "band":
      return `
        <path d="M360 200 Q500 160 640 200 L620 820 Q500 860 380 820 Z" fill="${c}" stroke="${edge}" stroke-width="6"/>
        ${Array.from({ length: 14 }, (_, i) => `<line x1="372" y1="${250 + i * 40}" x2="628" y2="${250 + i * 40}" stroke="${edge}" stroke-width="3" opacity="0.6"/>`).join("")}
        <rect x="400" y="470" width="200" height="60" rx="14" fill="${hi}" stroke="${edge}" stroke-width="4"/>`;
    case "tag":
      return `
        <rect x="330" y="330" width="340" height="340" rx="110" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <circle cx="500" cy="500" r="70" fill="none" stroke="${edge}" stroke-width="6"/>
        <circle cx="610" cy="390" r="22" fill="${BG}" stroke="${edge}" stroke-width="6"/>
        <circle cx="500" cy="500" r="8" fill="${accent}"/>`;
    case "phone":
      return `
        <rect x="350" y="150" width="300" height="700" rx="54" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <rect x="372" y="172" width="256" height="656" rx="38" fill="#0B0B0C"/>
        <rect x="465" y="192" width="70" height="20" rx="10" fill="${deep}"/>
        <rect x="398" y="690" width="204" height="10" rx="5" fill="#2A2A2F"/>
        <rect x="398" y="250" width="120" height="14" rx="7" fill="#26262B"/>
        <rect x="398" y="280" width="180" height="14" rx="7" fill="#1E1E22"/>
        <circle cx="500" cy="750" r="7" fill="${accent}"/>`;
    case "speaker-column":
      return `
        <rect x="380" y="140" width="240" height="720" rx="24" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <circle cx="500" cy="340" r="82" fill="${deep}"/>
        <circle cx="500" cy="340" r="30" fill="${edge}"/>
        <circle cx="500" cy="610" r="56" fill="${deep}"/>
        <circle cx="500" cy="610" r="20" fill="${edge}"/>
        <circle cx="500" cy="800" r="7" fill="${accent}"/>`;
    case "speaker-pebble":
      return `
        <ellipse cx="500" cy="520" rx="260" ry="210" fill="${c}" stroke="${edge}" stroke-width="8"/>
        ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 9 }, (_, k) => `<circle cx="${340 + k * 40}" cy="${440 + r * 40}" r="7" fill="${deep}"/>`).join("")).join("")}
        <rect x="455" y="300" width="90" height="26" rx="13" fill="${edge}"/>`;
    case "charger":
      return `
        <rect x="340" y="340" width="320" height="320" rx="56" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <rect x="420" y="250" width="26" height="110" rx="10" fill="${shade("#A7A9AC", 0)}"/>
        <rect x="554" y="250" width="26" height="110" rx="10" fill="#A7A9AC"/>
        <rect x="430" y="520" width="140" height="34" rx="17" fill="${deep}"/>
        <rect x="430" y="580" width="140" height="34" rx="17" fill="${deep}"/>
        <circle cx="500" cy="440" r="8" fill="${accent}"/>`;
    case "cable":
      return `
        <path d="M330 760 C330 520 680 640 680 420 C680 250 420 260 420 380 C420 470 560 480 600 380" fill="none" stroke="${edge}" stroke-width="40" stroke-linecap="round"/>
        <path d="M330 760 C330 520 680 640 680 420 C680 250 420 260 420 380 C420 470 560 480 600 380" fill="none" stroke="${c}" stroke-width="28" stroke-linecap="round" stroke-dasharray="14 8"/>
        <rect x="300" y="740" width="60" height="120" rx="14" fill="#A7A9AC"/>
        <rect x="586" y="300" width="60" height="110" rx="14" fill="#A7A9AC" transform="rotate(20 616 355)"/>`;
    case "case":
      return `
        <rect x="340" y="160" width="320" height="680" rx="62" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <rect x="380" y="200" width="120" height="150" rx="34" fill="${deep}"/>
        <circle cx="500" cy="540" r="110" fill="none" stroke="${edge}" stroke-width="10"/>
        <circle cx="500" cy="760" r="7" fill="${accent}"/>`;
    case "dock":
      return `
        <path d="M230 700 L770 700 L740 780 L260 780 Z" fill="${c}" stroke="${edge}" stroke-width="8"/>
        <rect x="280" y="330" width="200" height="370" rx="30" fill="${deep}" stroke="${edge}" stroke-width="6"/>
        <circle cx="610" cy="520" r="90" fill="${deep}" stroke="${edge}" stroke-width="6"/>
        <rect x="560" y="640" width="100" height="50" rx="24" fill="${deep}"/>
        <circle cx="720" cy="740" r="7" fill="${accent}"/>`;
  }
}

function svg(kind: ArtShape, color: string, view: "front" | "detail"): string {
  // The detail view zooms in and shifts, giving the gallery a second angle.
  const transform = view === "front" ? "translate(100 100) scale(1)" : "translate(-420 -260) scale(1.75)";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1200 1200">
    <defs>
      <radialGradient id="light" cx="50%" cy="38%" r="65%">
        <stop offset="0" stop-color="#1E1E22"/>
        <stop offset="1" stop-color="${BG}"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="1200" fill="url(#light)"/>
    <ellipse cx="600" cy="1010" rx="330" ry="34" fill="#0B0B0C" opacity="${view === "front" ? 0.7 : 0}"/>
    <g transform="${transform}">${shape(kind, color)}</g>
  </svg>`;
}

export function imageFileName(slug: string, variantSku: string | null, view: "front" | "detail"): string {
  return `${slug}${variantSku ? `-${variantSku.toLowerCase()}` : ""}-${view}.webp`;
}

async function render(file: string, markup: string) {
  await sharp(Buffer.from(markup)).webp({ quality: 86 }).toFile(join(OUT, file));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let count = 0;
  for (const p of products) {
    const primary = p.variants[0]!.colorHex ?? "#2A2A2F";
    await render(imageFileName(p.slug, null, "front"), svg(p.shape, primary, "front"));
    await render(imageFileName(p.slug, null, "detail"), svg(p.shape, primary, "detail"));
    count += 2;
    const colors = new Set(p.variants.map((v) => v.colorHex));
    if (colors.size > 1) {
      for (const v of p.variants) {
        await render(imageFileName(p.slug, v.sku, "front"), svg(p.shape, v.colorHex ?? primary, "front"));
        await render(imageFileName(p.slug, v.sku, "detail"), svg(p.shape, v.colorHex ?? primary, "detail"));
        count += 2;
      }
    }
  }
  console.log(`generated ${count} images in public/products`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
