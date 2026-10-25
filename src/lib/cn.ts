import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the custom utilities so later classes win.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label-mono"] }],
    },
  },
});

/** Joins class names; when two classes conflict (h-12 vs h-11), the last one wins. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return merge(parts.filter(Boolean).join(" "));
}
