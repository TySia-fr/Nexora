import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { BrandIntro } from "@/components/brand/brand-intro";
import { Hero } from "@/components/home/hero";
import { NewsletterForm } from "@/components/home/newsletter-form";
import {
  ArrowLink,
  Categories,
  CoreCollection,
  Engineering,
  HaloStudy,
  MonolithCampaign,
  NewArrivals,
  Policies,
  SectionHeading,
} from "@/components/home/sections";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <BrandIntro />
      <Hero />

      <section aria-labelledby="study-title" className="container-site pb-24 md:pb-36">
        <SectionHeading
          index="01"
          label="Featured"
          id="study-title"
          title="An object first. Then a pair of headphones."
          intro="Every part of Halo One that you touch is a material decision: metal where it carries load, foam where it meets skin."
        />
        <Suspense fallback={<div className="aspect-[4/3] rounded-card bg-well lg:w-2/3" />}>
          <HaloStudy />
        </Suspense>
      </section>

      <section aria-labelledby="collection-title" className="container-site pb-24 md:pb-36">
        <SectionHeading
          index="02"
          label="Collection"
          title="The core collection"
          id="collection-title"
          action={
            <Link href="/products">
              <ArrowLink>View all products</ArrowLink>
            </Link>
          }
        />
        <Suspense fallback={<GridSkeleton />}>
          <CoreCollection />
        </Suspense>
      </section>

      <section aria-labelledby="categories-title" className="container-site pb-24 md:pb-36">
        <SectionHeading index="03" label="Categories" title="Shop by category" id="categories-title" />
        <Suspense fallback={<div className="aspect-[5/1.6] rounded-card bg-well" />}>
          <Categories />
        </Suspense>
      </section>

      <Engineering />

      <Suspense fallback={<div className="theme-dark h-[640px]" />}>
        <MonolithCampaign />
      </Suspense>

      <section aria-labelledby="new-title" className="container-site py-24 md:py-36">
        <SectionHeading index="06" label="New arrivals" title="Recently added" id="new-title" />
        <Suspense fallback={<div className="h-80" />}>
          <NewArrivals />
        </Suspense>
      </section>

      <Policies />

      <section aria-labelledby="newsletter-title" className="container-site pb-24 md:pb-32">
        <div className="rule-tick grid gap-10 pt-10 md:grid-cols-12 md:gap-8">
          <div className="flex flex-col gap-5 md:col-span-7" data-reveal>
            <span className="label-mono text-fg-subtle">07 / Newsletter</span>
            <h2 id="newsletter-title" className="text-display-l">
              Product drops,
              <br />
              not spam.
            </h2>
            <p className="max-w-sm text-[15px] text-fg-muted">
              One email per launch. Unsubscribe in one click.
            </p>
          </div>
          <div
            className="flex items-end md:col-span-5"
            data-reveal
            style={{ "--reveal-delay": "120ms" } as CSSProperties}
          >
            <div className="w-full">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-well" />
      ))}
    </div>
  );
}
