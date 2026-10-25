import { describe, expect, it } from "vitest";
import { computeTotals, evaluateCoupon, type CouponRule, type PricedLine } from "./pricing";

const now = new Date("2026-10-25T12:00:00Z");
const audio = "cat_audio";
const accessories = "cat_acc";

const lines: PricedLine[] = [
  { unitPriceCents: 34900, quantity: 1, categoryId: audio },
  { unitPriceCents: 5900, quantity: 1, categoryId: accessories },
];

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  code: "NEXORA10",
  type: "PERCENT",
  value: 10,
  minSubtotalCents: 0,
  categoryId: null,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  redemptionCount: 0,
  isActive: true,
  ...over,
});

describe("computeTotals", () => {
  it("matches the checkout design example", () => {
    const t = computeTotals({ lines, coupon: coupon(), shippingMethod: "STANDARD", now });
    expect(t).toMatchObject({
      subtotalCents: 40800,
      discountCents: 4080,
      shippingCents: 0,
      totalCents: 36720,
      appliedCoupon: "NEXORA10",
    });
  });

  it("charges standard shipping below the threshold, measured after discount", () => {
    const t = computeTotals({
      lines: [{ unitPriceCents: 10500, quantity: 1, categoryId: audio }],
      coupon: coupon(), // 105.00 - 10.50 = 94.50 < 99
      shippingMethod: "STANDARD",
      now,
    });
    expect(t.shippingCents).toBe(690);
    expect(t.totalCents).toBe(9450 + 690);
    expect(t.freeShippingRemainingCents).toBe(450);
  });

  it("always charges for express", () => {
    const t = computeTotals({ lines, coupon: null, shippingMethod: "EXPRESS", now });
    expect(t.shippingCents).toBe(1290);
  });

  it("charges nothing for an empty cart", () => {
    const t = computeTotals({ lines: [], coupon: null, shippingMethod: "STANDARD", now });
    expect(t.totalCents).toBe(0);
  });

  it("keeps the total when a coupon is rejected, and says why", () => {
    const t = computeTotals({
      lines,
      coupon: coupon({ endsAt: new Date("2026-10-01") }),
      shippingMethod: "STANDARD",
      now,
    });
    expect(t.discountCents).toBe(0);
    expect(t.couponRejection).toBe("expired");
    expect(t.appliedCoupon).toBeNull();
  });

  it("rejects non-integer prices and quantities", () => {
    expect(() =>
      computeTotals({
        lines: [{ unitPriceCents: 10.5, quantity: 1, categoryId: audio }],
        coupon: null,
        shippingMethod: "STANDARD",
        now,
      }),
    ).toThrow();
    expect(() =>
      computeTotals({
        lines: [{ unitPriceCents: 1000, quantity: 0, categoryId: audio }],
        coupon: null,
        shippingMethod: "STANDARD",
        now,
      }),
    ).toThrow();
  });
});

describe("evaluateCoupon", () => {
  it.each([
    [{ isActive: false }, "inactive"],
    [{ startsAt: new Date("2026-11-01") }, "not_started"],
    [{ endsAt: now }, "expired"],
    [{ maxRedemptions: 5, redemptionCount: 5 }, "exhausted"],
    [{ minSubtotalCents: 50000 }, "below_minimum"],
    [{ categoryId: "cat_phones" }, "not_applicable"],
  ] as const)("rejects %o as %s", (over, reason) => {
    expect(evaluateCoupon(coupon(over), lines, now)).toEqual({ rejection: reason });
  });

  it("limits a category coupon to that category", () => {
    expect(evaluateCoupon(coupon({ categoryId: accessories }), lines, now)).toEqual({
      discountCents: 590,
    });
  });

  it("never discounts more than the eligible amount", () => {
    expect(
      evaluateCoupon(coupon({ type: "FIXED", value: 10000, categoryId: accessories }), lines, now),
    ).toEqual({ discountCents: 5900 });
  });
});
