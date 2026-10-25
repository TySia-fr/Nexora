import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { ArrowLink, SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/components/product/product-card";
import { AncDiagram } from "@/components/home/anc-diagram";
import { getCategories, getFeaturedProducts, getNewArrivals, getProductBySlug } from "@/server/catalog";
import anchors from "../../../public/brand/anchors.json";

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

// ---------------------------------------------------------------------------
// 01 — Halo One as an object, with callouts placed from the 3D render's own geometry.
// ---------------------------------------------------------------------------

const callouts = [
  {
    key: "ring",
    title: "Machined aluminium frame",
    body: "The ring and yokes are machined aluminium, not plated plastic.",
  },
  {
    key: "cushion",
    title: "Memory-foam cushions",
    body: "Wrapped in a recycled leather alternative that seals around the ear.",
  },
  { key: "light", title: "Status light", body: "One quiet point of light for power, pairing and charge." },
] as const;

export async function HaloStudy() {
  await connection();
  const product = await getProductBySlug("halo-one");
  if (!product) return null;
  const pos = anchors["halo-one-side.webp"];
  const price = product.variants[0]?.priceCents;
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <figure className="relative lg:col-span-8" data-reveal="clip">
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-well">
          <Image
            src="/brand/halo-one-side.webp"
            alt="Halo One in Bone, seen from the right, showing the outer ring, cushions and status light"
            fill
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="object-cover"
          />
          {callouts.map((c, i) => {
            const [x, y] = pos[c.key];
            return (
              <span
                key={c.key}
                aria-hidden="true"
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute hidden -translate-x-1/2 -translate-y-1/2 md:block"
              >
                {/* The reveal animates transform, so it sits on an inner element. */}
                <span className="flex items-center justify-center" data-reveal style={delay(500 + i * 120)}>
                  <span className="absolute size-9 rounded-full border border-fg/25" />
                  <span className="label-mono flex size-6 items-center justify-center rounded-full bg-fg text-[10px] text-canvas">
                    {i + 1}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        <figcaption className="label-mono mt-3 flex justify-between text-fg-subtle">
          <span>Fig. 02 — Halo One, Bone</span>
          <span>Studio render</span>
        </figcaption>
      </figure>
      <div className="flex flex-col justify-between gap-10 lg:col-span-4">
        <ol className="flex flex-col" role="list">
          {callouts.map((c, i) => (
            <li
              key={c.key}
              className="grid grid-cols-[32px_1fr] gap-3 border-t border-line py-5"
              data-reveal
              style={delay(i * 90)}
            >
              <span className="label-mono pt-1 text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">{c.title}</span>
                <span className="text-[14px] leading-relaxed text-fg-muted">{c.body}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-5 border-t border-line pt-6" data-reveal>
          <div className="flex items-baseline justify-between">
            <span className="text-display-m">{product.name}</span>
            {price && <Price cents={price} className="text-sm" />}
          </div>
          <div className="flex items-center gap-2" aria-label={`${product.variants.length} finishes`}>
            {product.variants.map((v) => (
              <span key={v.id} className="flex items-center gap-2 text-[13px] text-fg-muted">
                <span
                  className="size-3 rounded-full ring-1 ring-fg/15"
                  style={{ backgroundColor: v.colorHex ?? undefined }}
                  aria-hidden="true"
                />
                <span className="mr-2">{v.name}</span>
              </span>
            ))}
          </div>
          <ButtonLink href="/products/halo-one" arrow className="self-start">
            View Halo One
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 02 — Core collection: one large tile, four standard ones.
// ---------------------------------------------------------------------------

export async function CoreCollection() {
  await connection();
  const featured = await getFeaturedProducts(5);
  // Halo One already leads the page, so it closes the grid rather than opening it.
  const ordered = [
    ...featured.filter((p) => p.slug !== "halo-one"),
    ...featured.filter((p) => p.slug === "halo-one"),
  ];
  const [lead, ...rest] = ordered;
  if (!lead) return null;
  return (
    <ul
      className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4 lg:grid-rows-[auto_auto]"
      role="list"
    >
      <li className="col-span-2 lg:row-span-2" data-reveal>
        <ProductCard product={lead} index={1} feature sizes="(min-width: 1024px) 50vw, 100vw" />
      </li>
      {rest.slice(0, 4).map((p, i) => (
        <li key={p.id} data-reveal style={delay(80 + i * 70)}>
          <ProductCard product={p} index={i + 2} />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 03 — Categories with product imagery; hover adds motion, touch gets the same link.
// ---------------------------------------------------------------------------

const categoryArt: Record<string, string> = {
  audio: "/products/pulse-buds-front.webp",
  phones: "/products/axis-2-pro-front.webp",
  wearables: "/products/orbit-watch-front.webp",
  speakers: "/products/pebble-front.webp",
  accessories: "/products/dock-three-front.webp",
};

export async function Categories() {
  await connection();
  const categories = await getCategories();
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-5" role="list">
      {categories.map((c, i) => (
        <li
          key={c.slug}
          className={i === categories.length - 1 && categories.length % 2 ? "col-span-2 md:col-span-1" : ""}
          data-reveal
          style={delay(i * 70)}
        >
          <Link
            href={`/categories/${c.slug}`}
            className="group flex h-full flex-col gap-3 rounded-card focus-visible:outline-offset-4"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-well transition-colors duration-300 group-hover:bg-line">
              {categoryArt[c.slug] && (
                <Image
                  src={categoryArt[c.slug]!}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.05]"
                />
              )}
              <span className="label-mono absolute top-3.5 left-3.5 text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-xl font-medium tracking-[-0.02em]">{c.name}</span>
              <span className="label-mono flex items-center gap-1.5 text-fg-subtle">
                {c.productCount}
                <span
                  className="inline-block transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  →
                </span>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 04 — Engineering story (dark).
// ---------------------------------------------------------------------------

const engSpecs = [
  ["Microphones", "6", "Adaptive noise cancelling"],
  ["Battery", "40 h", "With cancelling on"],
  ["Fast charge", "10 min", "For up to 5 h of playback"],
  ["Weight", "254 g", "Aluminium frame"],
] as const;

export function Engineering() {
  return (
    <section aria-labelledby="engineering-title" className="theme-dark overflow-hidden">
      <div className="container-site py-24 md:py-36">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-6 lg:col-span-5">
            <span className="label-mono flex items-center gap-2.5 text-fg-subtle" data-reveal>
              <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              04 / Engineering — Halo One
            </span>
            <h2 id="engineering-title" className="text-display-l" data-reveal style={delay(80)}>
              Six microphones.
              <br />
              <span className="text-fg-subtle">One quiet room.</span>
            </h2>
            <p className="max-w-md text-[17px] leading-relaxed text-fg-muted" data-reveal style={delay(160)}>
              Halo One listens to the world around you and to the seal around each ear, then adjusts
              cancellation continuously. No presets to choose, nothing to tune.
            </p>
          </div>
          <div className="lg:col-span-7 lg:pl-8">
            <AncDiagram />
          </div>
        </div>
        <dl className="mt-20 grid grid-cols-2 border-t border-line md:mt-28 lg:grid-cols-4">
          {engSpecs.map(([k, v, note], i) => (
            <div
              key={k}
              className="flex flex-col gap-3 border-b border-line py-7 pr-4 lg:border-b-0 lg:border-l lg:px-6 lg:first:border-l-0 lg:first:pl-0"
              data-reveal
              style={delay(i * 90)}
            >
              <dt className="label-mono flex justify-between text-fg-subtle">
                <span>{k}</span>
                <span>0{i + 1}</span>
              </dt>
              <dd className="flex flex-col gap-1.5">
                <span className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">{v}</span>
                <span className="text-[13px] text-fg-subtle">{note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 05 — Monolith campaign (full width, dark).
// ---------------------------------------------------------------------------

export async function MonolithCampaign() {
  await connection();
  const product = await getProductBySlug("monolith");
  if (!product) return null;
  const bone = product.variants.find((v) => v.name === "Bone") ?? product.variants[0];
  const size = product.specs.find((s) => s.label === "Size")?.value;
  const output = product.specs.find((s) => s.label === "Output")?.value;
  return (
    <section aria-labelledby="campaign-title" className="theme-dark relative overflow-hidden">
      <div className="relative aspect-[4/3] md:absolute md:inset-0 md:aspect-auto" data-reveal="clip">
        <Image
          src="/brand/monolith-campaign.webp"
          alt="Monolith in Bone on a dark concrete plinth, lit from the left"
          fill
          sizes="100vw"
          className="object-cover object-[82%_50%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-canvas/70 via-canvas/10 to-transparent max-md:hidden"
          aria-hidden="true"
        />
      </div>
      <div className="container-site relative flex flex-col gap-6 py-14 md:min-h-[min(88vh,820px)] md:justify-center md:py-24">
        <div className="flex max-w-lg flex-col gap-6">
          <span className="label-mono text-fg-subtle" data-reveal>
            05 / Campaign — {product.name}
          </span>
          <h2 id="campaign-title" className="text-display-l" data-reveal style={delay(80)}>
            Stands still, so the room doesn&apos;t have to.
          </h2>
          <p className="max-w-md leading-relaxed text-fg-muted" data-reveal style={delay(160)}>
            {product.description}
          </p>
          <dl className="grid max-w-md grid-cols-2 border-t border-line" data-reveal style={delay(220)}>
            {[
              ["Output", output],
              ["Size", size],
            ].map(([k, v]) =>
              v ? (
                <div key={k} className="flex flex-col gap-1 border-b border-line py-4 pr-4">
                  <dt className="label-mono text-fg-subtle">{k}</dt>
                  <dd className="text-sm">{v}</dd>
                </div>
              ) : null,
            )}
          </dl>
          {bone && (
            <div data-reveal style={delay(280)}>
              <ButtonLink href={`/products/${product.slug}`} arrow>
                Discover {product.name} — <Price cents={bone.priceCents} />
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 06 — New arrivals as an index.
// ---------------------------------------------------------------------------

export async function NewArrivals() {
  await connection();
  const products = await getNewArrivals(5);
  return (
    <ol className="border-t border-line" role="list">
      {products.map((p, i) => (
        <li key={p.id} data-reveal style={delay(i * 60)}>
          <Link
            href={`/products/${p.slug}`}
            className="group grid grid-cols-[40px_56px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-4 md:grid-cols-[64px_72px_minmax(0,1fr)_200px_auto] md:gap-6 md:py-5"
          >
            <span className="label-mono text-fg-subtle">{String(i + 1).padStart(3, "0")}</span>
            <span className="relative aspect-square overflow-hidden rounded-[3px] bg-well">
              {p.image && (
                <Image
                  src={p.image.url}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              )}
            </span>
            <span className="truncate font-display text-xl font-medium tracking-[-0.02em] transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1 md:text-3xl">
              {p.name}
            </span>
            <span className="hidden text-sm text-fg-subtle md:inline">{p.categoryName}</span>
            <Price cents={p.priceFromCents} from={p.hasPriceRange} className="text-[13px]" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Store policies: every line is implemented (see /shipping, /returns, checkout).
// ---------------------------------------------------------------------------

export function Policies() {
  const items = [
    ["Free shipping over €99", "Standard delivery in mainland France. €6.90 below the threshold."],
    ["30-day returns", "Unused items in their original packaging."],
    ["2-year legal guarantee", "The EU legal guarantee of conformity applies to every product."],
    ["Secure checkout", "Payments are handled by Stripe. Card details never reach our servers."],
  ];
  return (
    <section aria-label="Store policies" className="container-site pb-24 md:pb-32">
      <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4" role="list">
        {items.map(([k, v], i) => (
          <li
            key={k}
            className="flex flex-col gap-2 border-b border-line py-7 pr-6 lg:border-b-0"
            data-reveal
            style={delay(i * 70)}
          >
            <span className="label-mono text-fg-subtle">0{i + 1}</span>
            <span className="text-[15px] font-medium">{k}</span>
            <span className="text-[13px] leading-relaxed text-fg-subtle">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { SectionHeading, ArrowLink };
