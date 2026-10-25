"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent } from "react";
import { Maximize2, X } from "lucide-react";
import type { ProductImageView } from "@/server/catalog";
import { cn } from "@/lib/cn";

export function Gallery({
  images,
  index,
  onIndexChange,
  productName,
}: {
  images: ProductImageView[];
  index: number;
  onIndexChange: (i: number) => void;
  productName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = images[Math.min(index, images.length - 1)];

  const onKeyDown = (e: KeyboardEvent) => {
    if (images.length < 2) return;
    if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
    if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
  };

  if (!current) {
    return <div className="aspect-square rounded-card border border-line bg-graphite" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[80px_minmax(0,1fr)]">
      <div
        className="order-last flex gap-2.5 md:order-first md:flex-col"
        role="group"
        aria-label={`${productName} images`}
      >
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            onClick={() => onIndexChange(i)}
            aria-label={`Show image ${i + 1} of ${images.length}: ${img.alt}`}
            aria-pressed={i === index}
            className={cn(
              "relative size-16 overflow-hidden rounded-input border bg-graphite md:size-20",
              i === index ? "border-paper" : "border-line hover:border-line-strong",
            )}
          >
            <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
      <div
        className="relative aspect-square overflow-hidden rounded-card border border-line bg-graphite"
        tabIndex={images.length > 1 ? 0 : -1}
        onKeyDown={onKeyDown}
        aria-roledescription="image viewer"
        aria-label={images.length > 1 ? "Use left and right arrow keys to change image" : undefined}
      >
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="animate-rise object-cover"
        />
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Enlarge image"
          className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full border border-line-strong bg-ink/80 hover:border-paper"
        >
          <Maximize2 className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
        </button>
        <span className="label-mono absolute bottom-4 left-4 text-fog" aria-hidden="true">
          {index + 1} / {images.length}
        </span>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`${productName}, enlarged image`}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-ink/95"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      >
        <div className="relative h-[min(92vh,92vw)] w-[min(92vh,92vw)]">
          <Image src={current.url} alt={current.alt} fill sizes="92vw" className="object-contain" />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close enlarged image"
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full border border-line-strong bg-ink text-paper"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </dialog>
    </div>
  );
}
