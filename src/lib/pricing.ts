import { assertCents, percentOf, type Cents } from "@/lib/money";

/**
 * Pure pricing rules. No I/O: callers load current prices and the coupon from
 * the database, then call `computeTotals`. The same function prices the cart
 * page, the checkout page and the order that is written to the database, so
 * the three can never disagree.
 */

export const FREE_SHIPPING_THRESHOLD: Cents = 9900;
export const SHIPPING_RATES = {
  STANDARD: 690,
  EXPRESS: 1290,
} as const satisfies Record<string, Cents>;
export type ShippingMethodCode = keyof typeof SHIPPING_RATES;

export type PricedLine = {
  unitPriceCents: Cents;
  quantity: number;
  categoryId: string;
};

export type CouponRule = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotalCents: Cents;
  categoryId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
};

export type CouponRejection =
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "below_minimum"
  | "not_applicable";

export const COUPON_REJECTION_MESSAGES: Record<CouponRejection, string> = {
  inactive: "This code is not valid.",
  not_started: "This code is not active yet.",
  expired: "This code has expired.",
  exhausted: "This code has reached its usage limit.",
  below_minimum: "Your order is below the minimum for this code.",
  not_applicable: "This code doesn't apply to the items in your cart.",
};

export type Totals = {
  subtotalCents: Cents;
  discountCents: Cents;
  shippingCents: Cents;
  totalCents: Cents;
  appliedCoupon: string | null;
  couponRejection: CouponRejection | null;
  freeShippingRemainingCents: Cents;
};

export function lineTotal(line: PricedLine): Cents {
  assertCents(line.unitPriceCents);
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new RangeError(`Invalid quantity ${line.quantity}`);
  }
  return line.unitPriceCents * line.quantity;
}

export function evaluateCoupon(
  coupon: CouponRule,
  lines: PricedLine[],
  now: Date,
): { discountCents: Cents } | { rejection: CouponRejection } {
  if (!coupon.isActive) return { rejection: "inactive" };
  if (coupon.startsAt && now < coupon.startsAt) return { rejection: "not_started" };
  if (coupon.endsAt && now >= coupon.endsAt) return { rejection: "expired" };
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { rejection: "exhausted" };
  }

  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  if (subtotal < coupon.minSubtotalCents) return { rejection: "below_minimum" };

  const eligible = lines
    .filter((l) => coupon.categoryId === null || l.categoryId === coupon.categoryId)
    .reduce((sum, l) => sum + lineTotal(l), 0);
  if (eligible === 0) return { rejection: "not_applicable" };

  const raw = coupon.type === "PERCENT" ? percentOf(eligible, coupon.value) : coupon.value;
  return { discountCents: Math.min(raw, eligible) };
}

export function shippingFor(method: ShippingMethodCode, merchandiseCents: Cents): Cents {
  if (method === "STANDARD" && merchandiseCents >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_RATES[method];
}

export function computeTotals(input: {
  lines: PricedLine[];
  coupon: CouponRule | null;
  shippingMethod: ShippingMethodCode;
  now: Date;
}): Totals {
  const subtotalCents = input.lines.reduce((sum, l) => sum + lineTotal(l), 0);

  let discountCents = 0;
  let appliedCoupon: string | null = null;
  let couponRejection: CouponRejection | null = null;
  if (input.coupon) {
    const result = evaluateCoupon(input.coupon, input.lines, input.now);
    if ("rejection" in result) couponRejection = result.rejection;
    else {
      discountCents = result.discountCents;
      appliedCoupon = input.coupon.code;
    }
  }

  const merchandise = subtotalCents - discountCents;
  // An empty cart has nothing to ship.
  const shippingCents = input.lines.length === 0 ? 0 : shippingFor(input.shippingMethod, merchandise);

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: merchandise + shippingCents,
    appliedCoupon,
    couponRejection,
    freeShippingRemainingCents: Math.max(0, FREE_SHIPPING_THRESHOLD - merchandise),
  };
}
