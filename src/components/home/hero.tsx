import Image from "next/image";
import { Suspense, type CSSProperties } from "react";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { HeroVisual } from "@/components/home/hero-visual";
import { getProductBySlug } from "@/server/catalog";

export const HERO_PRODUCT = "halo-one";

/** Animation delay on the hero sequence; `--seq` is set while the first-visit intro plays. */
const at = (ms: number) => ({ animationDelay: `calc(var(--seq, 0ms) + ${ms}ms)` }) as CSSProperties;

const index = [
  ["Cancelling", "Adaptive · 6 mics"],
  ["Battery", "Up to 40 h"],
  ["Weight", "254 g"],
] as const;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="container-site pt-6 pb-20 md:pt-10 md:pb-28">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch lg:gap-8">
        <div className="flex flex-col justify-between gap-12 lg:col-span-6 lg:py-6 xl:col-span-5">
          <div className="flex flex-col gap-7">
            <p className="label-mono flex animate-fade items-center gap-2.5 text-fg-muted" style={at(100)}>
              <span className="size-1.5 rounded-full bg-signal ring-1 ring-fg/20" aria-hidden="true" />
              N°01 — New · Halo One
            </p>
            <h1 id="hero-title" className="text-display-xl">
              <span className="line-mask">
                <span className="animate-line" style={at(180)}>
                  Silence,
                </span>
              </span>
              <span className="line-mask">
                <span className="animate-line" style={at(270)}>
                  engineered.
                </span>
              </span>
            </h1>
            <p
              className="max-w-[26rem] animate-rise text-[17px] leading-relaxed text-fg-muted"
              style={at(420)}
            >
              Over-ear headphones with adaptive noise cancelling, a machined aluminium frame and up to 40
              hours on a single charge.
            </p>
            {/* Stacked on phones so the price streaming into the first button can't re-wrap the row (CLS). */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink
                href={`/products/${HERO_PRODUCT}`}
                size="lg"
                arrow
                className="animate-rise"
                style={at(520)}
              >
                Shop Halo One
                <Suspense fallback={null}>
                  <HeroPrice />
                </Suspense>
              </ButtonLink>
              <ButtonLink
                href="/categories/audio"
                variant="secondary"
                size="lg"
                className="animate-rise"
                style={at(590)}
              >
                Explore audio
              </ButtonLink>
            </div>
          </div>
          <dl className="grid animate-fade grid-cols-3 border-t border-line" style={at(760)}>
            {index.map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col gap-1.5 border-r border-line py-4 pr-3 last:border-r-0 [&:not(:first-child)]:pl-3"
              >
                <dt className="label-mono text-fg-subtle">{k}</dt>
                <dd className="text-[13px] font-medium sm:text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="relative lg:col-span-6 xl:col-span-7">
          <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-well sm:aspect-[8/9] lg:aspect-auto lg:h-full lg:min-h-[640px]">
            <HeroVisual>
              <Image
                src="/brand/hero-halo-one.webp"
                alt="Halo One headphones in graphite, standing on a concrete plinth in raking light"
                fill
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover object-[50%_60%]"
              />
            </HeroVisual>
            {/* Curtain reveal. The image underneath paints immediately (so LCP isn't delayed);
                only this overlay moves. */}
            <span className="curtain" style={at(160)} aria-hidden="true" />
          </div>
          <figcaption
            className="pointer-events-none absolute inset-x-4 top-4 flex animate-fade justify-between text-fg md:inset-x-5 md:top-5"
            style={at(900)}
          >
            <span className="label-mono">Fig. 01 — Halo One, Graphite</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

async function HeroPrice() {
  await connection();
  const product = await getProductBySlug(HERO_PRODUCT);
  const price = product?.variants[0]?.priceCents;
  return price ? (
    <span className="text-canvas/70">
      — <Price cents={price} />
    </span>
  ) : null;
}
