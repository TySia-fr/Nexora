"use client";

import { useEffect } from "react";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * One observer for the whole document: any element with `data-reveal` animates in the
 * first time it enters the viewport. Server Components only add an attribute, so no
 * section has to become a Client Component to animate.
 *
 * The reveal runs through the Web Animations API instead of toggling an attribute or a
 * class: streamed sections may still be waiting to hydrate when they scroll into view,
 * and changing their attributes would make React report a hydration mismatch.
 * A MutationObserver picks up content streamed in later or rendered after navigation.
 */
export function RevealObserver() {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new WeakSet<Element>();

    const reveal = (el: Element) => {
      if (seen.has(el)) return;
      seen.add(el);
      const delay = reduce ? 0 : parseFloat(getComputedStyle(el).getPropertyValue("--reveal-delay")) || 0;
      const clip = el.getAttribute("data-reveal") === "clip";
      if (clip) {
        el.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], {
          pseudoElement: "::after",
          duration: reduce ? 0 : 1000,
          delay,
          easing: EASE_OUT,
          fill: "both",
        });
      } else {
        el.animate(
          [
            { opacity: 0, transform: "translateY(18px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: reduce ? 0 : 640, delay, easing: EASE_OUT, fill: "both" },
        );
      }
      el.querySelectorAll(".anc-draw").forEach((svg) =>
        svg.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
          duration: reduce ? 0 : 1400,
          delay: reduce ? 0 : delay + 150,
          easing: EASE_IN_OUT,
          fill: "both",
        }),
      );
    };

    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach(reveal);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const scan = (root: ParentNode) =>
      root.querySelectorAll("[data-reveal]").forEach((el) => !seen.has(el) && io.observe(el));
    scan(document);
    const mo = new MutationObserver((records) => {
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches("[data-reveal]")) io.observe(n);
          scan(n);
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
