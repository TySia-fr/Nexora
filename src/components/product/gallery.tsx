"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Maximize2, X } from "lucide-react";
import type { ProductImageView } from "@/server/catalog";
import { cn } from "@/lib/cn";

/**
 * Product gallery. Images are stacked and cross-fade (opacity only), so switching never
 * shifts layout. Keyboard: arrow keys on the viewer. Touch: horizontal swipe.
 * The enlarged view is a native <dialog> (focus trap and Escape for free).
 */
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
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const active = Math.min(index, images.length - 1);
  const current = images[active];
  const many = images.length > 1;
  const go = (delta: number) => onIndexChange((active + delta + images.length) % images.length);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!many) return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !many) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx < 0 ? 1 : -1);
  };

  if (!current) {
    return <div className="aspect-square rounded-card bg-well" />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)] md:gap-4">
      <div
        className="order-last -m-1 flex gap-2 overflow-x-auto p-1 md:order-first md:flex-col md:overflow-visible"
        role="group"
        aria-label={`${productName} images`}
      >
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            onClick={() => onIndexChange(i)}
            aria-label={`Show image ${i + 1} of ${images.length}: ${img.alt}`}
            aria-pressed={i === active}
            className={cn(
              "relative size-16 shrink-0 overflow-hidden rounded-[3px] bg-well ring-offset-2 ring-offset-canvas transition-[box-shadow,opacity] duration-200 md:size-[72px]",
              i === active ? "ring-1 ring-fg" : "opacity-70 hover:opacity-100",
            )}
          >
            <Image src={img.url} alt="" fill sizes="72px" className="object-cover" />
          </button>
        ))}
      </div>
      <div
        className="relative aspect-square touch-pan-y overflow-hidden rounded-card bg-well select-none"
        tabIndex={many ? 0 : -1}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-roledescription="image viewer"
        aria-label={many ? "Use left and right arrow keys to change image" : undefined}
      >
        {images.map((img, i) => (
          <Image
            key={`${img.url}-${i}`}
            src={img.url}
            alt={i === active ? img.alt : ""}
            aria-hidden={i !== active}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 55vw, 100vw"
            draggable={false}
            className={cn(
              "object-cover transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)]",
              i === active ? "scale-100 opacity-100" : "scale-[1.02] opacity-0",
            )}
          />
        ))}
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Enlarge image"
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-canvas/80 text-fg backdrop-blur-sm transition-colors hover:bg-canvas"
        >
          <Maximize2 className="size-4" strokeWidth={1.6} aria-hidden="true" />
        </button>
        {many && (
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-3" aria-hidden="true">
            <span className="label-mono text-fg-subtle tabular-nums">
              {String(active + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </span>
            <span className="flex flex-1 gap-1">
              {images.map((img, i) => (
                <span key={`${img.url}-bar-${i}`} className="h-px flex-1 bg-fg/15">
                  <span
                    className={cn(
                      "block h-full origin-left bg-fg transition-transform duration-500 ease-[var(--ease-out-expo)]",
                      i === active ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`${productName}, enlarged image`}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-canvas/95 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      >
        <div className="relative h-[min(92vh,92vw)] w-[min(92vh,92vw)]">
          <Image src={current.url} alt={current.alt} fill sizes="92vw" className="object-contain" />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close enlarged image"
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-fg text-canvas"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </dialog>
    </div>
  );
}
