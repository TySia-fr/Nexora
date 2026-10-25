"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Subtle pointer-responsive drift for the hero image. Only on devices with a fine
 * pointer and when reduced motion is not requested; one rAF per pointer move at most,
 * transform only, listeners removed on unmount. Without JavaScript the image is static.
 */
export function HeroVisual({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;
    const host = el.parentElement ?? el;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.transform = `translate3d(${x * -10}px, ${y * -8}px, 0) scale(1.03)`;
    };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      x = (e.clientX - r.left) / r.width - 0.5;
      y = (e.clientY - r.top) / r.height - 0.5;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      x = y = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="absolute inset-0 scale-[1.03] transition-transform duration-700 ease-[var(--ease-out-expo)] will-change-transform"
    >
      {children}
    </div>
  );
}
