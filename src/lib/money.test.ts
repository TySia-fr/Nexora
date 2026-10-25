import { describe, expect, it } from "vitest";
import { assertCents, formatMoney, percentOf } from "./money";

describe("money", () => {
  it("formats cents as euros", () => {
    expect(formatMoney(34900)).toBe("€349.00");
    expect(formatMoney(0)).toBe("€0.00");
  });

  it("rejects non-integer amounts", () => {
    expect(() => assertCents(10.5)).toThrow(TypeError);
    expect(() => formatMoney(Number.NaN)).toThrow(TypeError);
  });

  it("computes percentages with half-up rounding to the cent", () => {
    expect(percentOf(40800, 10)).toBe(4080);
    expect(percentOf(999, 10)).toBe(100); // 99.9 -> 100
    expect(percentOf(994, 10)).toBe(99); // 99.4 -> 99
  });

  it("rejects out-of-range percentages", () => {
    expect(() => percentOf(1000, 101)).toThrow(RangeError);
    expect(() => percentOf(1000, 2.5)).toThrow(RangeError);
  });
});
