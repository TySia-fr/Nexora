import { describe, expect, it } from "vitest";
import { hit } from "./rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit per window, then blocks, then resets", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(hit("k", 3, 1000, t0)).toBe(true);
    expect(hit("k", 3, 1000, t0 + 10)).toBe(false);
    expect(hit("other", 3, 1000, t0 + 10)).toBe(true);
    expect(hit("k", 3, 1000, t0 + 1001)).toBe(true);
  });
});
