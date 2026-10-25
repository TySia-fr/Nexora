/**
 * Demo catalog. Every product, name and specification is fictional and
 * written for this project; none describes a real device.
 * Images are rendered from these definitions by scripts/render/render-products.ts.
 */

export type ArtShape =
  | "headphones"
  | "earbuds"
  | "watch"
  | "band"
  | "tag"
  | "phone"
  | "speaker-column"
  | "speaker-pebble"
  | "charger"
  | "cable"
  | "case"
  | "travel-case"
  | "dock";

/** Stable image file names: re-rendering never needs a database change. */
export function imageFileName(slug: string, variantSku: string | null, view: "front" | "detail"): string {
  return `${slug}${variantSku ? `-${variantSku.toLowerCase()}` : ""}-${view}.webp`;
}

export type SeedVariant = {
  sku: string;
  name: string;
  colorHex?: string;
  priceCents: number;
  stock: number;
};

export type SeedProduct = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  shape: ArtShape;
  featured?: boolean;
  unitsSold: number;
  /** Days before the seed date the product was "launched" (drives "newest"). */
  ageDays: number;
  specs: { label: string; value: string }[];
  features: { title: string; body: string }[];
  variants: SeedVariant[];
};

export const categories = [
  {
    slug: "audio",
    name: "Audio",
    description: "Headphones and earbuds tuned for long listening, with noise cancelling that adapts to you.",
    position: 1,
  },
  {
    slug: "phones",
    name: "Phones",
    description: "The Axis line: flat aluminium, a quiet interface and batteries that outlast the day.",
    position: 2,
  },
  {
    slug: "wearables",
    name: "Wearables",
    description: "Watches and trackers that stay out of the way until you need them.",
    position: 3,
  },
  {
    slug: "speakers",
    name: "Speakers",
    description: "Room-filling sound from objects you'd keep on the shelf even when they're off.",
    position: 4,
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Chargers, cables, cases and docks designed alongside the devices they serve.",
    position: 5,
  },
] as const;

const GRAPHITE = "#2A2A2F";
const BONE = "#D9D8D2";
const SIGNAL = "#C8F135";
const SLATE = "#5B6470";
const STEEL = "#A7A9AC";

export const products: SeedProduct[] = [
  {
    slug: "halo-one",
    name: "Halo One",
    tagline: "Over-ear headphones",
    description:
      "Halo One pairs adaptive noise cancelling with a machined aluminium frame and memory-foam cushions wrapped in a recycled leather alternative. It folds flat, charges over USB-C and stays connected to two devices at once.",
    category: "audio",
    shape: "headphones",
    featured: true,
    unitsSold: 412,
    ageDays: 6,
    specs: [
      { label: "Driver", value: "40 mm dynamic, beryllium-coated" },
      { label: "Noise cancelling", value: "Adaptive, 6 microphones" },
      { label: "Battery", value: "Up to 40 h with ANC on" },
      { label: "Charging", value: "USB-C · 10 min for 5 h" },
      { label: "Connectivity", value: "Bluetooth 5.4, multipoint (2 devices)" },
      { label: "Weight", value: "254 g" },
    ],
    features: [
      { title: "Adaptive cancelling", body: "Measures the seal around your ear and adjusts in real time." },
      { title: "Folds flat", body: "Hinged aluminium yokes fold into a 3 cm travel case." },
      { title: "Two devices at once", body: "Move between laptop and phone without re-pairing." },
    ],
    variants: [
      { sku: "NX-HALO1-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 34900, stock: 14 },
      { sku: "NX-HALO1-BNE", name: "Bone", colorHex: BONE, priceCents: 34900, stock: 3 },
      { sku: "NX-HALO1-SGL", name: "Signal", colorHex: SIGNAL, priceCents: 34900, stock: 0 },
    ],
  },
  {
    slug: "pulse-buds",
    name: "Pulse Buds",
    tagline: "Wireless earbuds",
    description:
      "Pulse Buds fit in the ear without a stem, cancel noise with three microphones per side and give you seven hours per charge, 28 with the case.",
    category: "audio",
    shape: "earbuds",
    featured: true,
    unitsSold: 655,
    ageDays: 40,
    specs: [
      { label: "Driver", value: "11 mm dynamic" },
      { label: "Noise cancelling", value: "Hybrid, 3 mics per bud" },
      { label: "Battery", value: "7 h buds · 28 h with case" },
      { label: "Water resistance", value: "IPX4" },
      { label: "Case charging", value: "USB-C and Qi wireless" },
      { label: "Weight", value: "4.9 g per bud" },
    ],
    features: [
      { title: "Stemless fit", body: "Three tip sizes and a contour that sits flush with the ear." },
      { title: "Transparency mode", body: "Hear announcements without taking them out." },
    ],
    variants: [
      { sku: "NX-PULSE-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 17900, stock: 38 },
      { sku: "NX-PULSE-BNE", name: "Bone", colorHex: BONE, priceCents: 17900, stock: 21 },
    ],
  },
  {
    slug: "pulse-buds-lite",
    name: "Pulse Buds Lite",
    tagline: "Everyday earbuds",
    description:
      "The Pulse sound in a lighter body, without active noise cancelling. Six hours per charge and a case that fits a coin pocket.",
    category: "audio",
    shape: "earbuds",
    unitsSold: 301,
    ageDays: 120,
    specs: [
      { label: "Driver", value: "10 mm dynamic" },
      { label: "Battery", value: "6 h buds · 24 h with case" },
      { label: "Water resistance", value: "IPX4" },
      { label: "Weight", value: "4.1 g per bud" },
    ],
    features: [{ title: "Pocket case", body: "A 38 mm case with a magnetic lid." }],
    variants: [{ sku: "NX-PULSEL-SLT", name: "Slate", colorHex: SLATE, priceCents: 9900, stock: 44 }],
  },
  {
    slug: "axis-2",
    name: "Axis 2",
    tagline: "Smartphone",
    description:
      "A 6.1-inch phone with a flat aluminium frame, a 120 Hz OLED display and a two-day battery. No bloat, no ads in the system apps.",
    category: "phones",
    shape: "phone",
    featured: true,
    unitsSold: 189,
    ageDays: 75,
    specs: [
      { label: "Display", value: '6.1" OLED, 120 Hz, 1400 nits peak' },
      { label: "Storage", value: "128 GB or 256 GB" },
      { label: "Battery", value: "4,600 mAh · up to 2 days" },
      { label: "Camera", value: "50 MP main, 12 MP ultra-wide" },
      { label: "Charging", value: "45 W wired, 15 W wireless" },
      { label: "Weight", value: "176 g" },
    ],
    features: [
      { title: "Five years of updates", body: "Security and OS updates until 2031." },
      { title: "Repairable", body: "Screen and battery replace with standard screws." },
    ],
    variants: [
      { sku: "NX-AXIS2-128-GRP", name: "128 GB · Graphite", colorHex: GRAPHITE, priceCents: 79900, stock: 9 },
      { sku: "NX-AXIS2-256-GRP", name: "256 GB · Graphite", colorHex: GRAPHITE, priceCents: 89900, stock: 0 },
      { sku: "NX-AXIS2-256-BNE", name: "256 GB · Bone", colorHex: BONE, priceCents: 89900, stock: 4 },
    ],
  },
  {
    slug: "axis-2-mini",
    name: "Axis 2 Mini",
    tagline: "Compact smartphone",
    description: "Everything in Axis 2 in a 5.4-inch body you can use with one hand.",
    category: "phones",
    shape: "phone",
    unitsSold: 97,
    ageDays: 60,
    specs: [
      { label: "Display", value: '5.4" OLED, 120 Hz' },
      { label: "Storage", value: "128 GB" },
      { label: "Battery", value: "3,900 mAh · all day" },
      { label: "Weight", value: "144 g" },
    ],
    features: [{ title: "One-handed", body: "Every control is reachable with your thumb." }],
    variants: [
      { sku: "NX-AXIS2M-128-SLT", name: "128 GB · Slate", colorHex: SLATE, priceCents: 64900, stock: 12 },
    ],
  },
  {
    slug: "axis-2-pro",
    name: "Axis 2 Pro",
    tagline: "Smartphone, larger display",
    description: "A 6.7-inch display, a periscope telephoto and the largest battery we've fitted to a phone.",
    category: "phones",
    shape: "phone",
    unitsSold: 64,
    ageDays: 30,
    specs: [
      { label: "Display", value: '6.7" OLED, 1–120 Hz' },
      { label: "Storage", value: "512 GB" },
      { label: "Camera", value: "50 MP main, 50 MP ultra-wide, 5× telephoto" },
      { label: "Battery", value: "5,200 mAh" },
    ],
    features: [
      { title: "5× telephoto", body: "Optical zoom without a camera bump that wobbles on the table." },
    ],
    variants: [
      {
        sku: "NX-AXIS2P-512-GRP",
        name: "512 GB · Graphite",
        colorHex: GRAPHITE,
        priceCents: 109900,
        stock: 0,
      },
    ],
  },
  {
    slug: "orbit-watch",
    name: "Orbit Watch",
    tagline: "Smartwatch",
    description:
      "A round watch with an always-on display, heart-rate and SpO₂ sensors and a week of battery life. It shows what you need and then goes quiet.",
    category: "wearables",
    shape: "watch",
    featured: true,
    unitsSold: 240,
    ageDays: 90,
    specs: [
      { label: "Case", value: "41 mm steel or 45 mm aluminium" },
      { label: "Display", value: "Always-on AMOLED, sapphire glass" },
      { label: "Battery", value: "Up to 7 days" },
      { label: "Sensors", value: "Heart rate, SpO₂, skin temperature" },
      { label: "Water resistance", value: "5 ATM" },
    ],
    features: [
      { title: "A week per charge", body: "Typical use, always-on display included." },
      { title: "Quiet hours", body: "Notifications pause automatically while you sleep." },
    ],
    variants: [
      { sku: "NX-ORBIT-41-STL", name: "41 mm · Steel", colorHex: STEEL, priceCents: 29900, stock: 2 },
      { sku: "NX-ORBIT-45-GRP", name: "45 mm · Graphite", colorHex: GRAPHITE, priceCents: 32900, stock: 17 },
    ],
  },
  {
    slug: "orbit-band-woven",
    name: "Orbit Band, woven",
    tagline: "Watch strap",
    description: "A breathable woven strap with a magnetic clasp. Fits both Orbit case sizes.",
    category: "wearables",
    shape: "band",
    unitsSold: 120,
    ageDays: 3,
    specs: [
      { label: "Fits", value: "Orbit Watch 41 mm and 45 mm" },
      { label: "Wrist size", value: "130–200 mm" },
      { label: "Material", value: "Recycled polyester weave" },
    ],
    features: [{ title: "Tool-free swap", body: "Press, slide, done." }],
    variants: [
      { sku: "NX-BAND-W-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 4900, stock: 30 },
      { sku: "NX-BAND-W-SGL", name: "Signal", colorHex: SIGNAL, priceCents: 4900, stock: 25 },
      { sku: "NX-BAND-W-BNE", name: "Bone", colorHex: BONE, priceCents: 4900, stock: 18 },
    ],
  },
  {
    slug: "trace-tag",
    name: "Trace Tag",
    tagline: "Item tracker",
    description: "A 30 mm tracker for keys and bags with a replaceable coin cell that lasts a year.",
    category: "wearables",
    shape: "tag",
    unitsSold: 510,
    ageDays: 150,
    specs: [
      { label: "Size", value: "30 × 30 × 7 mm" },
      { label: "Battery", value: "CR2032, about 12 months" },
      { label: "Range", value: "Bluetooth up to 40 m" },
    ],
    features: [{ title: "Replaceable battery", body: "No glue, no waste: twist the back off." }],
    variants: [{ sku: "NX-TAG-BNE", name: "Bone", colorHex: BONE, priceCents: 2900, stock: 120 }],
  },
  {
    slug: "monolith",
    name: "Monolith",
    tagline: "Home speaker",
    description:
      "360° sound from a single column of anodised aluminium. Two woofers, three tweeters and room calibration that runs in the background.",
    category: "speakers",
    shape: "speaker-column",
    featured: true,
    unitsSold: 133,
    ageDays: 10,
    specs: [
      { label: "Drivers", value: '2 × 4" woofers, 3 × 0.75" tweeters' },
      { label: "Output", value: "360°, room-calibrated" },
      { label: "Connectivity", value: "Wi-Fi 6, Bluetooth 5.3, AirPlay-compatible" },
      { label: "Size", value: "320 × 120 × 120 mm" },
    ],
    features: [
      { title: "Self-calibrating", body: "Re-tunes itself when you move it." },
      { title: "Stereo pairs", body: "Two Monoliths link into a stereo pair in one tap." },
    ],
    variants: [
      { sku: "NX-MONO-BNE", name: "Bone", colorHex: BONE, priceCents: 27900, stock: 5 },
      { sku: "NX-MONO-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 27900, stock: 11 },
    ],
  },
  {
    slug: "pebble",
    name: "Pebble",
    tagline: "Portable speaker",
    description: "A palm-sized speaker that floats, survives a drop onto concrete and plays for 14 hours.",
    category: "speakers",
    shape: "speaker-pebble",
    unitsSold: 288,
    ageDays: 200,
    specs: [
      { label: "Battery", value: "Up to 14 h" },
      { label: "Durability", value: "IP67, 1.2 m drop-tested" },
      { label: "Weight", value: "310 g" },
    ],
    features: [{ title: "It floats", body: "Pool, lake or bath: it stays on top." }],
    variants: [
      { sku: "NX-PEBBLE-SLT", name: "Slate", colorHex: SLATE, priceCents: 8900, stock: 40 },
      { sku: "NX-PEBBLE-SGL", name: "Signal", colorHex: SIGNAL, priceCents: 8900, stock: 0 },
    ],
  },
  {
    slug: "column-studio",
    name: "Column Studio",
    tagline: "Floor-standing speakers, pair",
    description:
      "A pair of slim floor-standing speakers with built-in amplification. Connect a turntable, a TV or nothing at all.",
    category: "speakers",
    shape: "speaker-column",
    unitsSold: 21,
    ageDays: 180,
    specs: [
      { label: "Amplification", value: "2 × 80 W class-D" },
      { label: "Inputs", value: "HDMI eARC, phono, optical, Wi-Fi" },
      { label: "Height", value: "980 mm" },
    ],
    features: [{ title: "Built-in phono stage", body: "Plug a turntable straight in." }],
    variants: [{ sku: "NX-COLUMN-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 54900, stock: 3 }],
  },
  {
    slug: "flux-65w",
    name: "Flux 65W charger",
    tagline: "USB-C charger",
    description:
      "A two-port 65 W GaN charger with folding pins. Charges a laptop and a phone at the same time.",
    category: "accessories",
    shape: "charger",
    featured: false,
    unitsSold: 702,
    ageDays: 1,
    specs: [
      { label: "Output", value: "65 W max, 2 × USB-C" },
      { label: "Size", value: "52 × 52 × 30 mm" },
      { label: "Plug", value: "EU, folding" },
    ],
    features: [{ title: "Shares intelligently", body: "Splits power based on what each device asks for." }],
    variants: [{ sku: "NX-FLUX65-WHT", name: "White", colorHex: "#EDEDEA", priceCents: 5900, stock: 85 }],
  },
  {
    slug: "flux-140w",
    name: "Flux 140W charger",
    tagline: "USB-C charger, three ports",
    description:
      "Three ports, 140 W in total: enough for a large laptop, a phone and earbuds from one socket.",
    category: "accessories",
    shape: "charger",
    unitsSold: 156,
    ageDays: 45,
    specs: [
      { label: "Output", value: "140 W max, 2 × USB-C + USB-A" },
      { label: "Plug", value: "EU" },
    ],
    features: [{ title: "Three at once", body: "Laptop, phone and earbuds from one socket." }],
    variants: [{ sku: "NX-FLUX140-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 9900, stock: 26 }],
  },
  {
    slug: "usb-c-braided-cable",
    name: "USB-C braided cable",
    tagline: "2 m, 100 W",
    description: "A two-metre braided cable rated for 100 W and 10 Gbps data.",
    category: "accessories",
    shape: "cable",
    unitsSold: 940,
    ageDays: 240,
    specs: [
      { label: "Length", value: "2 m" },
      { label: "Power", value: "100 W" },
      { label: "Data", value: "10 Gbps" },
    ],
    features: [{ title: "Tested to 30,000 bends", body: "The braid outlasts the devices." }],
    variants: [{ sku: "NX-CABLE2-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 1900, stock: 200 }],
  },
  {
    slug: "axis-2-magnetic-case",
    name: "Axis 2 magnetic case",
    tagline: "Phone case",
    description: "A thin case with a built-in magnet ring for wireless chargers and mounts.",
    category: "accessories",
    shape: "case",
    unitsSold: 230,
    ageDays: 4,
    specs: [
      { label: "Fits", value: "Axis 2" },
      { label: "Material", value: "Recycled polycarbonate, soft-touch finish" },
      { label: "Thickness", value: "1.2 mm" },
    ],
    features: [{ title: "Magnet ring", body: "Snaps onto chargers and mounts." }],
    variants: [
      { sku: "NX-CASE-AX2-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 3900, stock: 60 },
      { sku: "NX-CASE-AX2-SGL", name: "Signal", colorHex: SIGNAL, priceCents: 3900, stock: 14 },
    ],
  },
  {
    slug: "halo-travel-case",
    name: "Halo travel case",
    tagline: "Hard case for Halo One",
    description: "A hard-shell case with a cable pocket, shaped around Halo One folded flat.",
    category: "accessories",
    shape: "travel-case",
    unitsSold: 88,
    ageDays: 6,
    specs: [
      { label: "Fits", value: "Halo One" },
      { label: "Size", value: "200 × 175 × 45 mm" },
    ],
    features: [{ title: "Cable pocket", body: "Holds the USB-C and audio cables." }],
    variants: [{ sku: "NX-HALOCASE-GRP", name: "Graphite", colorHex: GRAPHITE, priceCents: 3500, stock: 22 }],
  },
  {
    slug: "dock-three",
    name: "Dock Three",
    tagline: "Charging dock",
    description: "Charges a phone, a watch and earbuds on one aluminium stand, from one cable.",
    category: "accessories",
    shape: "dock",
    unitsSold: 74,
    ageDays: 20,
    specs: [
      { label: "Output", value: "15 W phone · 5 W watch · 5 W earbuds" },
      { label: "Input", value: "USB-C, 30 W adapter required" },
    ],
    features: [{ title: "One cable", body: "Three devices, one socket." }],
    variants: [{ sku: "NX-DOCK3-STL", name: "Steel", colorHex: STEEL, priceCents: 12900, stock: 7 }],
  },
];

export type SeedCoupon = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotalCents: number;
  maxRedemptions?: number;
  endsAt?: Date;
  categorySlug?: string;
};

export const coupons: SeedCoupon[] = [
  { code: "NEXORA10", type: "PERCENT", value: 10, minSubtotalCents: 0 },
  { code: "WELCOME15", type: "PERCENT", value: 15, minSubtotalCents: 20000, maxRedemptions: 100 },
  { code: "AUDIO20", type: "FIXED", value: 2000, minSubtotalCents: 10000, categorySlug: "audio" },
  // Expired on purpose, to demonstrate the rejection message.
  {
    code: "SUMMER25",
    type: "PERCENT",
    value: 25,
    minSubtotalCents: 0,
    endsAt: new Date("2026-09-01T00:00:00Z"),
  },
];

/** Fictional reviewers. Reviews are seeded as verified purchases with matching paid orders. */
export const reviewers = [
  { name: "Camille Roux", email: "camille.roux@example.com" },
  { name: "Jonas Meyer", email: "jonas.meyer@example.com" },
  { name: "Inès Tazi", email: "ines.tazi@example.com" },
  { name: "Paul Dubois", email: "paul.dubois@example.com" },
  { name: "Léa Bernard", email: "lea.bernard@example.com" },
];

export const reviews: { product: string; reviewer: number; rating: number; title: string; body: string }[] = [
  {
    product: "halo-one",
    reviewer: 0,
    rating: 5,
    title: "Quietest pair I have owned",
    body: "My train commute went from loud to nothing. The clamp is firm for the first week, then settles.",
  },
  {
    product: "halo-one",
    reviewer: 1,
    rating: 4,
    title: "Great sound, bulky case",
    body: "Balanced out of the box, no EQ needed. The case is bigger than I expected.",
  },
  {
    product: "halo-one",
    reviewer: 2,
    rating: 5,
    title: "The battery is real",
    body: "Two weeks of office use between charges.",
  },
  {
    product: "pulse-buds",
    reviewer: 3,
    rating: 4,
    title: "Comfortable for hours",
    body: "They don't stick out, so I can lie on my side with them in. Touch controls take getting used to.",
  },
  {
    product: "pulse-buds",
    reviewer: 4,
    rating: 5,
    title: "Replaced my old earbuds",
    body: "Noise cancelling is better than I expected at this size.",
  },
  {
    product: "orbit-watch",
    reviewer: 0,
    rating: 4,
    title: "Finally a week of battery",
    body: "I charge it on Sundays. Sleep tracking is decent, the app could be faster.",
  },
  {
    product: "monolith",
    reviewer: 1,
    rating: 5,
    title: "Fills the living room",
    body: "Calibration made a real difference in our long room.",
  },
  {
    product: "flux-65w",
    reviewer: 2,
    rating: 5,
    title: "Laptop and phone, one plug",
    body: "Tiny, and the folding pins mean it lives in my bag.",
  },
];
