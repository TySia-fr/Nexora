"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Heart, Minus, Plus } from "lucide-react";
import type { ProductDetailView } from "@/server/catalog";
import { addToCartAction } from "@/server/actions/cart";
import { toggleWishlistAction } from "@/server/actions/wishlist";
import { Gallery } from "@/components/product/gallery";
import { Price } from "@/components/ui/price";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

const LOW_STOCK = 5;
const RECENT_KEY = "nx:recently-viewed";

type Status = { kind: "success" | "error"; text: string; link?: { href: string; label: string } } | null;

export function ProductPurchase({
  product,
  initialSku,
  signedIn,
  initiallySaved,
}: {
  product: ProductDetailView;
  initialSku?: string;
  signedIn: boolean;
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(
    product.variants.find((v) => v.sku === initialSku)?.id ?? firstAvailable?.id,
  );
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<Status>(null);
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const [savePending, startSave] = useTransition();
  // Brief confirmation on the button itself after a successful add (the status line below
  // stays as the accessible, persistent message).
  const [justAdded, setJustAdded] = useState(false);
  // Mobile: a compact purchase bar appears once the main button has scrolled out of view.
  const mainButton = useRef<HTMLButtonElement>(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1800);
    return () => clearTimeout(t);
  }, [justAdded]);

  useEffect(() => {
    // A passive scroll check (one read per frame) rather than IntersectionObserver: a jump
    // straight past the button (anchor link, restored scroll) never crosses a threshold,
    // so an observer would miss it.
    const el = mainButton.current;
    if (!el) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setShowBar(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  // Remember this product for "recently viewed" (stays in this browser only).
  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
      const ids = Array.isArray(prev) ? prev.filter((x): x is string => typeof x === "string") : [];
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([product.id, ...ids.filter((i) => i !== product.id)].slice(0, 8)),
      );
    } catch {
      // Storage unavailable (private mode): the feature is simply off.
    }
  }, [product.id]);

  if (!variant) return null;
  const soldOut = variant.stock === 0;
  const maxQty = Math.max(1, Math.min(10, variant.stock));

  function selectVariant(id: string) {
    setVariantId(id);
    setImageIndex(0);
    setQty(1);
    setStatus(null);
    const sku = product.variants.find((v) => v.id === id)?.sku;
    if (sku) window.history.replaceState(null, "", `?variant=${encodeURIComponent(sku)}`);
  }

  function add() {
    if (!variant || soldOut) return;
    setStatus(null);
    startTransition(async () => {
      const r = await addToCartAction(variant.id, qty);
      if (r.ok) {
        setJustAdded(true);
        setStatus({
          kind: "success",
          text: `Added to cart — ${product.name}, ${variant.name}. ${r.data.quantityInCart} in cart.`,
          link: { href: "/cart", label: "View cart" },
        });
      } else {
        setStatus({ kind: "error", text: r.message });
      }
    });
  }

  function toggleSave() {
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(`/products/${product.slug}`)}`);
      return;
    }
    startSave(async () => {
      const r = await toggleWishlistAction(product.id);
      if (r.ok) {
        setSaved(r.data.saved);
        setStatus({
          kind: "success",
          text: r.data.saved ? "Saved to your wishlist." : "Removed from your wishlist.",
        });
      } else setStatus({ kind: "error", text: r.message });
    });
  }

  const stockText = soldOut
    ? `${variant.name} is out of stock. Choose another option or check back later.`
    : variant.stock <= LOW_STOCK
      ? `In stock — ${variant.stock} left`
      : "In stock";

  return (
    <div className="flex flex-wrap items-start gap-x-16 gap-y-10">
      <div className="min-w-0 flex-[999_1_520px]">
        <Gallery
          images={variant.images}
          index={imageIndex}
          onIndexChange={setImageIndex}
          productName={product.name}
        />
      </div>

      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-7 lg:sticky lg:top-24">
        <div className="flex flex-col gap-3">
          <span className="label-mono flex items-center gap-2 text-fg-subtle">
            <span
              className={cn(
                "size-1.5 rounded-full",
                soldOut ? "bg-fg-subtle" : "bg-signal ring-1 ring-fg/20",
              )}
              aria-hidden="true"
            />
            {product.category.name} · {product.tagline}
          </span>
          <h1 className="text-display-m">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-4">
            <Price cents={variant.priceCents} className="text-[22px]" />
            {product.rating && (
              <a href="#reviews" className="text-[13px] text-fg-muted hover:text-accent">
                {product.rating.average.toFixed(1)} / 5 · {product.rating.count}{" "}
                {product.rating.count === 1 ? "review" : "reviews"}
              </a>
            )}
          </div>
        </div>

        {product.variants.length > 1 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="label-mono mb-3 text-fg-subtle">
              Option — <span className="text-fg">{variant.name}</span>
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {product.variants.map((v) => {
                const selected = v.id === variant.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVariant(v.id)}
                    aria-pressed={selected}
                    aria-label={`${v.name}${v.stock === 0 ? ", out of stock" : ""}, ${formatMoney(v.priceCents)}`}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm transition-[border-color,background-color] duration-150",
                      selected ? "border-fg bg-fg/[0.04]" : "border-line-strong hover:border-fg-muted",
                      v.stock === 0 && "text-fg-subtle line-through decoration-fg-subtle",
                    )}
                  >
                    {v.colorHex && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-4 rounded-full ring-1 ring-fg/15 transition-[box-shadow]",
                          selected && "ring-2 ring-fg ring-offset-2 ring-offset-canvas",
                        )}
                        style={{ backgroundColor: v.colorHex }}
                      />
                    )}
                    {v.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        <p className={cn("-mt-3 text-[13px]", soldOut ? "text-warn" : "text-fg-muted")}>{stockText}</p>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <div
              role="group"
              aria-label="Quantity"
              className="flex h-13 items-center rounded-full border border-line-strong"
            >
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={soldOut || qty <= 1}
                aria-label="Decrease quantity"
                className="flex size-12 items-center justify-center disabled:text-fg-subtle"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <output aria-live="polite" className="min-w-7 text-center font-mono text-sm">
                {qty}
              </output>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={soldOut || qty >= maxQty}
                aria-label="Increase quantity"
                className="flex size-12 items-center justify-center disabled:text-fg-subtle"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={toggleSave}
              disabled={savePending}
              aria-pressed={saved}
              aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
              className="flex size-13 items-center justify-center rounded-full border border-line-strong hover:border-fg"
            >
              <Heart
                className={cn("size-[18px]", saved && "fill-accent text-accent")}
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </button>
          </div>
          <button
            ref={mainButton}
            type="button"
            onClick={add}
            disabled={soldOut || pending}
            className={buttonClasses("primary", "md", "h-13 w-full")}
          >
            {soldOut ? (
              "Unavailable in this option"
            ) : pending ? (
              "Adding…"
            ) : justAdded ? (
              <>
                <Check className="size-4" strokeWidth={2} aria-hidden="true" /> Added
              </>
            ) : (
              `Add to cart — ${formatMoney(variant.priceCents * qty)}`
            )}
          </button>
        </div>

        <p
          role="status"
          className={cn("-mt-3 min-h-5 text-[13px]", status?.kind === "error" ? "text-warn" : "text-accent")}
        >
          {status?.text}{" "}
          {status?.link && (
            <Link href={status.link.href} className="underline underline-offset-4">
              {status.link.label}
            </Link>
          )}
        </p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 border-t border-line pt-5 font-mono text-xs text-fg-subtle uppercase">
          <dt>SKU</dt>
          <dd className="text-fg">{variant.sku}</dd>
          <dt>Delivery</dt>
          <dd className="text-fg">
            {variant.priceCents >= 9900
              ? "Free standard · 2–4 business days"
              : "€6.90 standard, free over €99"}
          </dd>
          <dt>Returns</dt>
          <dd className="text-fg">
            <Link href="/returns" className="hover:text-accent">
              30 days
            </Link>
          </dd>
        </dl>

        <p className="text-[15px] leading-relaxed text-fg-muted">{product.description}</p>
      </div>

      {/* Mobile purchase bar. `hidden` removes it from the accessibility tree while the
          main button is on screen, so there is never a duplicate control to announce. */}
      <div
        hidden={!showBar}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="container-site flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {product.name} · {variant.name}
            </span>
            <Price cents={variant.priceCents} className="text-xs text-fg-muted" />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={soldOut || pending}
            className={buttonClasses("primary", "sm", "shrink-0")}
          >
            {soldOut ? "Unavailable" : pending ? "Adding…" : justAdded ? "Added" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
