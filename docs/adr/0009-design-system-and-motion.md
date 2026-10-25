# ADR-0009 — Semantic colour tokens, scoped themes and CSS-first motion

**Status:** accepted · 2026-10-25

## Context

The redesign moves the store from a dark UI to a light, monochrome one with dark sections (engineering
story, campaign, footer, admin). The first design named colours literally (`ink`, `paper`, `ash`), so a
light theme would have meant either inverted names or a second set of classes on every component.

## Decision

**Colours are semantic** — `canvas`, `surface`, `well`, `fg`, `fg-muted`, `fg-subtle`, `line`, `accent`,
`warn`, `info` — defined once in `@theme`. `.theme-dark` redefines the same variables, so any subtree
switches theme with one class and components stay unaware of it. Brand constants (`signal`, `on-signal`)
are identical in both themes. Every pairing is checked for WCAG AA contrast (values in `globals.css`).

**Type:** Archivo (variable width, expanded 106–125 %) for display and the wordmark; Geist for text; Geist
Mono for technical labels. Archivo is subset to the weights, widths and glyphs in use (32 KB instead of
90 KB) so it can be preloaded without delaying the hero image.

**Motion is CSS-first and reduced-motion aware:**

- The hero sequence and the first-visit brand intro are pure CSS animations. An inline script decides
  before first paint whether the intro plays (homepage, once per session, not with reduced motion), so
  nothing waits on hydration and returning visitors never see it.
- Scroll reveals: Server Components add `data-reveal`; one client `RevealObserver` animates elements with
  the Web Animations API when they enter the viewport. Changing attributes instead would cause hydration
  mismatches on streamed sections that scroll into view before they hydrate.
- "Clip" reveals lift a pseudo-element curtain rather than clipping the element: a fully clipped element
  never intersects the viewport, so neither the observer nor lazy image loading would ever fire.
- The hero image is revealed by an overlay, so the LCP image paints immediately.
- No animation library was added; the existing Motion dependency is still only used by the mobile menu.

## Consequences

- Without JavaScript the page is complete (reveal styles only apply under `.js`).
- Light theme costs a few Lighthouse points on the homepage compared with the first release (heavier hero,
  one more font); measured numbers are in the README.
