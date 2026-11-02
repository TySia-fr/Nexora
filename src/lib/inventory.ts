/**
 * Pure inventory and reporting maths, shared by the server and unit-tested on its own.
 */

export type StockLevel = "out" | "low" | "ok" | "inactive";

export function stockLevel(available: number, reorderPoint: number, isActive = true): StockLevel {
  if (!isActive) return "inactive";
  if (available <= 0) return "out";
  if (available <= reorderPoint) return "low";
  return "ok";
}

/**
 * Days until the available stock runs out at the average daily rate of the window.
 * Null when nothing sold in the window (no rate to project from), 0 when sold out.
 */
export function daysOfCover(available: number, unitsSold: number, windowDays: number): number | null {
  if (available <= 0) return 0;
  if (unitsSold <= 0 || windowDays <= 0) return null;
  return Math.floor(available / (unitsSold / windowDays));
}

/** French standard VAT, in basis points. Prices on the store include it. */
export const VAT_RATE_BPS = 2000;

/** Removes VAT from a VAT-inclusive amount, rounded half up to the cent. */
export function exVat(cents: number, rateBps = VAT_RATE_BPS): number {
  return Math.round((cents * 10_000) / (10_000 + rateBps));
}

/** Percentage change between two periods; null when the previous value is zero. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * One CSV field. Quotes when needed, and neutralises spreadsheet formulas: a cell
 * starting with = + - @ (or a tab/CR) is prefixed with ' so Excel won't execute it.
 * Numbers are passed as numbers and never prefixed.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}
