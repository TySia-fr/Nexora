"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo";

const noop = () => () => {};

export function MobileNav({ categories }: { categories: { slug: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The header uses backdrop-filter, which would trap a `position: fixed` child inside
  // it; the dialog is portalled to <body> once mounted on the client.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

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
        className="flex size-11 items-center justify-center rounded-full hover:bg-well"
      >
        <Menu className="size-5" strokeWidth={1.6} aria-hidden="true" />
      </button>
      {mounted &&
        createPortal(
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
                  <span className="flex items-center gap-2.5">
                    <LogoMark className="size-[22px]" />
                    <Wordmark />
                  </span>
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
                <nav aria-label="Mobile" className="container-site flex flex-1 flex-col overflow-y-auto py-6">
                  {[{ slug: "", name: "Shop all" }, ...categories].map((c, i) => {
                    const href = c.slug ? `/categories/${c.slug}` : "/products";
                    const active = pathname === href;
                    return (
                      <motion.div
                        key={c.slug || "all"}
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.35,
                          delay: reduce ? 0 : 0.04 * i + 0.05,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className="flex items-center justify-between border-b border-line py-4 font-display text-[28px] font-medium tracking-[-0.02em]"
                        >
                          <span className="flex items-baseline gap-4">
                            <span className="label-mono text-fg-subtle">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            {c.name}
                          </span>
                          <ArrowUpRight
                            className="size-5 text-fg-subtle"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </Link>
                      </motion.div>
                    );
                  })}
                  <div className="mt-8 flex flex-col gap-4 text-[15px] text-fg-muted">
                    <Link href="/search">Search</Link>
                    <Link href="/account">Account</Link>
                    <Link href="/cart">Cart</Link>
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
