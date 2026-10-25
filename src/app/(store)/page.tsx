import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BrandIntro } from "@/components/brand/brand-intro";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGrid } from "@/components/product/product-card";
import { NewsletterForm } from "@/components/home/newsletter-form";
import { getCategories, getFeaturedProducts, getNewArrivals, getProductBySlug } from "@/server/catalog";

const HERO_PRODUCT = "halo-one";
const CAMPAIGN_PRODUCT = "monolith";

export default function HomePage() {
  return (
    <>
      <BrandIntro />
      <Hero />
      <section aria-labelledby="featured-title" className="container-site pb-28">
        <SectionHeading
          index="01"
          label="Featured"
          title="The core collection"
          id="featured-title"
          action={
            <Link href="/products" className="text-sm text-fg-muted hover:text-accent">
              View all products →
            </Link>
          }
        />
        <Suspense fallback={<GridSkeleton />}>
          <Featured />
        </Suspense>
      </section>

      <section aria-labelledby="categories-title" className="container-site pb-28">
        <SectionHeading index="02" label="Categories" title="Shop by category" id="categories-title" />
        <Suspense fallback={<div className="h-[440px] rounded-card bg-surface" />}>
          <Categories />
        </Suspense>
      </section>

      <section aria-labelledby="new-title" className="container-site pb-28">
        <SectionHeading index="03" label="New arrivals" />
        <h2 id="new-title" className="sr-only">
          New arrivals
        </h2>
        <Suspense fallback={<div className="h-80" />}>
          <NewArrivals />
        </Suspense>
      </section>

      <Engineering />

      <section aria-labelledby="campaign-title" className="container-site py-28">
        <Suspense fallback={<div className="h-[480px] rounded-card bg-surface" />}>
          <Campaign />
        </Suspense>
      </section>

      <Trust />

      <section aria-labelledby="newsletter-title" className="container-site pb-28">
        <div className="grid items-end gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 id="newsletter-title" className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Product drops, not spam.
            </h2>
            <p className="text-[15px] text-fg-muted">One email per launch. Unsubscribe in one click.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="container-site grid items-center gap-12 pt-12 pb-24 md:grid-cols-2 md:pt-18"
    >
      <div className="flex flex-col gap-7">
        <span className="label-mono text-accent">New · Halo One</span>
        <h1
          id="hero-title"
          className="text-[clamp(3rem,7vw,6rem)] leading-[0.95] font-semibold tracking-[-0.035em]"
        >
          Silence,
          <br />
          engineered.
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-fg-muted">
          Over-ear headphones with adaptive noise cancelling, a machined aluminium frame and 40 hours on a
          single charge.
        </p>
        {/* Stacked on phones so the price streaming into the first button can't
            re-wrap the row and shift the image below (CLS). */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink href={`/products/${HERO_PRODUCT}`} size="lg">
            Shop Halo One
            <Suspense fallback={null}>
              <HeroPrice />
            </Suspense>
          </ButtonLink>
          <ButtonLink href="/categories/audio" variant="secondary" size="lg">
            Explore audio
          </ButtonLink>
        </div>
      </div>
      <figure className="relative aspect-square overflow-hidden rounded-card border border-line bg-surface">
        <Image
          src="/products/halo-one-front.webp"
          alt="Halo One headphones in graphite"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        <figcaption className="label-mono absolute top-5 left-5 text-fg-subtle">
          Fig. 01 — Graphite
        </figcaption>
        <span className="label-mono absolute bottom-5 left-5 text-fg-subtle">ANC · 6-mic array</span>
        <span className="label-mono absolute right-5 bottom-5 text-fg-subtle">40 h battery</span>
      </figure>
    </section>
  );
}

async function HeroPrice() {
  await connection();
  const product = await getProductBySlug(HERO_PRODUCT);
  const price = product?.variants[0]?.priceCents;
  return price ? (
    <span>
      — <Price cents={price} />
    </span>
  ) : null;
}

async function Featured() {
  await connection();
  const products = await getFeaturedProducts(4);
  return <ProductGrid products={products} />;
}

async function Categories() {
  await connection();
  const categories = await getCategories();
  const [lead, ...rest] = categories;
  if (!lead) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        href={`/categories/${lead.slug}`}
        className="flex min-h-[440px] flex-col justify-between rounded-card bg-signal p-8 text-on-signal md:row-span-2"
      >
        <span className="label-mono">
          {lead.name} · {lead.productCount} products
        </span>
        <span className="text-5xl leading-none font-semibold tracking-[-0.03em] md:text-6xl">
          Hear
          <br />
          everything.
          <br />
          Or nothing.
        </span>
      </Link>
      {rest.map((c) => (
        <Link
          key={c.slug}
          href={`/categories/${c.slug}`}
          className="flex min-h-[200px] items-end justify-between rounded-card border border-line bg-surface p-6 hover:border-line-strong"
        >
          <span className="text-2xl font-medium">{c.name}</span>
          <span className="label-mono text-fg-subtle">{c.productCount} →</span>
        </Link>
      ))}
    </div>
  );
}

async function NewArrivals() {
  await connection();
  const products = await getNewArrivals(4);
  return (
    <ol className="border-t border-line" role="list">
      {products.map((p, i) => (
        <li key={p.id}>
          <Link
            href={`/products/${p.slug}`}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-5 hover:text-accent md:grid-cols-[64px_minmax(0,1fr)_auto_auto] md:gap-6"
          >
            <span className="label-mono text-fg-subtle">{String(i + 1).padStart(3, "0")}</span>
            <span className="truncate text-xl font-medium tracking-[-0.01em] md:text-3xl">{p.name}</span>
            <span className="hidden text-sm text-fg-subtle md:inline">{p.categoryName}</span>
            <Price cents={p.priceFromCents} from={p.hasPriceRange} className="text-sm" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Engineering() {
  const specs = [
    ["Noise reduction", "up to −42 dB"],
    ["Battery", "40 h"],
    ["Weight", "254 g"],
    ["Fast charge", "10 min = 5 h"],
  ];
  return (
    <section aria-labelledby="engineering-title" className="theme-dark border-y border-line">
      <div className="container-site grid gap-16 py-28 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <span className="label-mono text-accent">04 / Engineering</span>
          <h2
            id="engineering-title"
            className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl"
          >
            Six microphones.
            <br />
            One quiet room.
          </h2>
          <p className="max-w-md text-[17px] leading-relaxed text-fg-muted">
            Halo One listens to the world around you and to the seal around each ear, then adjusts
            cancellation continuously. No presets to choose, nothing to tune.
          </p>
        </div>
        <dl className="grid grid-cols-2 border-t border-line-strong">
          {specs.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1.5 border-b border-line-strong py-6">
              <dt className="label-mono text-fg-subtle">{k}</dt>
              <dd className="text-2xl font-medium md:text-3xl">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

async function Campaign() {
  await connection();
  const product = await getProductBySlug(CAMPAIGN_PRODUCT);
  if (!product) return null;
  const bone = product.variants.find((v) => v.name === "Bone") ?? product.variants[0];
  const image = bone?.images[0] ?? product.images[0];
  return (
    <div className="grid overflow-hidden rounded-card border border-line md:grid-cols-2">
      <div className="relative min-h-[420px] bg-surface">
        {image && (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-contain p-8"
          />
        )}
      </div>
      <div className="flex flex-col justify-center gap-5 bg-surface p-8 md:p-14">
        <span className="label-mono text-fg-subtle">05 / Campaign — {product.name}</span>
        <h2
          id="campaign-title"
          className="text-3xl leading-[1.05] font-semibold tracking-[-0.03em] md:text-[44px]"
        >
          A speaker that stands still so the room doesn&apos;t have to.
        </h2>
        <p className="leading-relaxed text-fg-muted">{product.description}</p>
        {bone && (
          <ButtonLink href={`/products/${product.slug}`} variant="secondary" className="self-start">
            Discover {product.name} — <Price cents={bone.priceCents} />
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function Trust() {
  const items = [
    ["Free shipping over €99", "Standard delivery in mainland France. €6.90 below the threshold."],
    ["30-day returns", "Unused items in their original packaging. See the returns policy."],
    ["2-year legal guarantee", "The EU legal guarantee of conformity applies to every product."],
    ["Secure checkout", "Payments are handled by Stripe. Card details never reach our servers."],
  ];
  return (
    <section aria-label="Store policies" className="container-site pb-24">
      <ul className="grid border-y border-line sm:grid-cols-2 lg:grid-cols-4" role="list">
        {items.map(([k, v]) => (
          <li key={k} className="flex flex-col gap-1.5 py-7 pr-6">
            <span className="text-[15px] font-medium">{k}</span>
            <span className="text-[13px] leading-relaxed text-fg-subtle">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-surface" />
      ))}
    </div>
  );
}
