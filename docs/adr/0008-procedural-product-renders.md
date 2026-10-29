# ADR-0008 — Product imagery rendered from procedural 3D models

**Status:** accepted · 2026-10-25 · supersedes the flat vector art of the first release

## Context

NEXORA's products are fictional, so there are no photographs of them. The first release used flat SVG
compositions: consistent, but clearly placeholders. The redesign needs studio-quality product images.

Options considered:

| Option                                 | Problem                                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock photos (Freepik, Unsplash…)      | They show other companies' products under our product names, which misrepresents the catalogue; licences vary (attribution, no trademarks); one photographer's lighting per image |
| AI-generated images                    | Do not match the catalogue's specifications (shape, ports, sizes); text and logos baked into the pixels                                                                           |
| Procedural 3D models, rendered offline | More work up front; looks like a render, not a photograph                                                                                                                         |

## Decision

Every product is a procedural three.js model (`scripts/render/models.js`) built from the catalogue's own
facts — Monolith is a 120 × 120 × 320 mm column because the spec says so, Axis 2 Pro has three lenses, Flux
140W has three ports. One studio (`studio.js`) lights them all: the same key, rim and fill lights, a soft
contact shadow and a transparent background, so the images sit on any surface colour.

`pnpm render:products` renders them in headless Chromium (WebGL via SwiftShader), supersampled and written
as WebP under stable file names, so re-rendering never needs a database change. Editorial shots for the
homepage use a "campaign set" (concrete plinth, raking key light, a hidden occluder for the shadow edge)
and export the projected position of named points, which the homepage uses to place its callouts exactly.

## Consequences

- No third-party assets and no licence questions; images can be regenerated after a spec change.
- The site discloses that product images are 3D renders (footer note on every page).
- They are renders: materials are good, not photoreal. A real launch would replace them with photography of
  real hardware; the pipeline (`next/image`, responsive sizes) is unchanged by that.
- Rendering all 77 images takes about 40 minutes on a CPU-only machine. It is not part of CI; the output is
  committed.
