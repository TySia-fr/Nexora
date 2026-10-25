/**
 * Money helpers. Amounts are always integer minor units (cents).
 * Floating point never touches a price.
 */

export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Expected an integer amount in cents, got ${value}`);
  }
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: Cents, currency = "EUR", locale = "en-IE"): string {
  assertCents(cents);
  const key = `${locale}:${currency}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, f);
  }
  return f.format(cents / 100);
}

/** Percentage of an amount, rounded half-up to the nearest cent. */
export function percentOf(cents: Cents, percent: number): Cents {
  assertCents(cents);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`Percent must be an integer between 0 and 100, got ${percent}`);
  }
  return Math.floor((cents * percent + 50) / 100);
}
