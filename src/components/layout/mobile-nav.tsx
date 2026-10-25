"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";

export function MobileNav({ categories }: { categories: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="order-last lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="flex size-11 items-center justify-center"
      >
        <Menu className="size-5" strokeWidth={1.6} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-50 flex flex-col bg-canvas"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="container-site flex h-16 items-center justify-between border-b border-line">
              <span className="text-lg font-bold tracking-[0.18em]">NEXORA</span>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center"
              >
                <X className="size-5" strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile" className="container-site flex flex-col py-6">
              {[{ slug: "", name: "All products" }, ...categories].map((c) => (
                <Link
                  key={c.slug || "all"}
                  href={c.slug ? `/categories/${c.slug}` : "/products"}
                  className="border-b border-line py-4 text-2xl font-medium tracking-[-0.01em]"
                >
                  {c.name}
                </Link>
              ))}
              <div className="mt-8 flex flex-col gap-4 text-fg-muted">
                <Link href="/search">Search</Link>
                <Link href="/account">Account</Link>
                <Link href="/cart">Cart</Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
