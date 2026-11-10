"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteImageAction, moveImageAction, updateImageAltAction } from "@/server/actions/media";
import { buttonClasses } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";

type Img = { id: string; url: string; alt: string; variant: string | null };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Upload, describe, reorder and remove a product's images. The first image is the cover. */
export function ImageManager({ productId, images }: { productId: string; images: Img[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch(`/admin/products/${productId}/images`, {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; message?: string } | null;
      if (res.ok && body?.ok) {
        form.current?.reset();
        setMessage({ tone: "ok", text: "Image uploaded." });
        router.refresh();
      } else setMessage({ tone: "error", text: body?.message ?? "Upload failed. Try again." });
    } catch {
      setMessage({ tone: "error", text: "Upload failed. Check your connection." });
    } finally {
      setUploading(false);
    }
  }

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done?: string) =>
    start(async () => {
      const res = await fn();
      setMessage(
        res.ok ? (done ? { tone: "ok", text: done } : null) : { tone: "error", text: res.message ?? "" },
      );
    });

  return (
    <section aria-labelledby="images-title" className="mb-10 rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="images-title" className="font-semibold">
          Images
        </h2>
        <span className="text-xs text-fg-muted">
          The first image is the cover. JPEG, PNG, WebP or AVIF, up to 8 MB; saved as WebP without metadata.
        </span>
      </div>

      {images.length === 0 ? (
        <p className="mb-4 text-sm text-fg-muted">No images yet.</p>
      ) : (
        <ul role="list" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="flex flex-col gap-2.5 rounded-input border border-line p-3">
              <div className="relative aspect-square overflow-hidden rounded-input bg-[#f5f5f2]">
                <Image src={img.url} alt={img.alt} fill sizes="240px" className="object-contain p-2" />
                {i === 0 && (
                  <span className="label-mono absolute left-2 top-2 rounded-full bg-night px-2 py-1 text-white">
                    Cover
                  </span>
                )}
                {img.variant && (
                  <span className="label-mono absolute right-2 top-2 rounded-full bg-night/80 px-2 py-1 text-white">
                    {img.variant}
                  </span>
                )}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const alt = String(new FormData(e.currentTarget).get("alt") ?? "");
                  run(() => updateImageAltAction(img.id, alt), "Description saved.");
                }}
              >
                <label htmlFor={`alt-${img.id}`} className="sr-only">
                  Image description
                </label>
                <input
                  id={`alt-${img.id}`}
                  name="alt"
                  defaultValue={img.alt}
                  className={`${inputBase} h-9 min-w-0 flex-1 text-xs`}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className={buttonClasses("secondary", "sm", "rounded-input")}
                >
                  Save
                </button>
              </form>
              <div className="flex items-center justify-between text-xs">
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveImageAction(img.id, -1))}
                    aria-label={`Move image ${i + 1} earlier`}
                    className="rounded-input border border-line px-2.5 py-1.5 hover:bg-well disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={pending || i === images.length - 1}
                    onClick={() => run(() => moveImageAction(img.id, 1))}
                    aria-label={`Move image ${i + 1} later`}
                    className="rounded-input border border-line px-2.5 py-1.5 hover:bg-well disabled:opacity-40"
                  >
                    →
                  </button>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Remove this image from the product?")) {
                      run(() => deleteImageAction(img.id), "Image removed.");
                    }
                  }}
                  className="text-warn hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={form} onSubmit={upload} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="image-file" className="text-xs text-fg-muted">
            Image file
          </label>
          <input id="image-file" name="file" type="file" accept={ACCEPT} required className="text-sm" />
        </div>
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <label htmlFor="image-alt" className="text-xs text-fg-muted">
            Description (alt text)
          </label>
          <input
            id="image-alt"
            name="alt"
            required
            minLength={3}
            maxLength={160}
            placeholder="Halo One in graphite, side view"
            className={`${inputBase} h-10`}
          />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className={buttonClasses("inverse", "sm", "rounded-input")}
        >
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      </form>
      {message && (
        <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-accent" : "text-warn"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
