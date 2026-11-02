import { describe, expect, it } from "vitest";
import { csvField, daysOfCover, exVat, percentChange, stockLevel, toCsv } from "./inventory";
import { adjustmentSchema, variantSettingsSchema } from "./validation/inventory";

describe("stock maths", () => {
  it("classifies stock against the reorder point", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(6, 5)).toBe("ok");
    expect(stockLevel(50, 5, false)).toBe("inactive");
  });

  it("projects days of cover from the sales rate", () => {
    expect(daysOfCover(10, 30, 30)).toBe(10);
    expect(daysOfCover(10, 7, 30)).toBe(42); // floor(10 / 0.2333)
    expect(daysOfCover(0, 30, 30)).toBe(0);
    expect(daysOfCover(10, 0, 30)).toBeNull();
  });

  it("removes 20 % VAT, rounding to the cent", () => {
    expect(exVat(12000)).toBe(10000);
    expect(exVat(999)).toBe(833); // 832.5 rounds half up
    expect(exVat(0)).toBe(0);
  });

  it("compares periods without dividing by zero", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe("CSV export", () => {
  it("quotes and escapes", () => {
    expect(csvField('He said "hi", twice')).toBe('"He said ""hi"", twice"');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField(null)).toBe("");
    expect(csvField(-3)).toBe("-3");
  });

  it.each(['=HYPERLINK("x")', "+1", "-1+1", "@SUM(A1)", "\tcmd"])("neutralises formula %j", (v) => {
    expect(csvField(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("ends rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x\r\n");
  });
});

describe("manual stock movements", () => {
  const base = { variantId: "v1", note: "" };
  it("turns write-offs into negative deltas", () => {
    expect(adjustmentSchema.parse({ ...base, reason: "DAMAGED", quantity: "2" }).delta).toBe(-2);
    expect(adjustmentSchema.parse({ ...base, reason: "RECEIVED", quantity: "12" }).delta).toBe(12);
    expect(
      adjustmentSchema.parse({ ...base, reason: "ADJUSTMENT", quantity: "-3", note: "Recount" }).delta,
    ).toBe(-3);
  });

  it("rejects zero, fractions, wrong signs and corrections without a reason", () => {
    for (const bad of [
      { reason: "RECEIVED", quantity: "0" },
      { reason: "RECEIVED", quantity: "1.5" },
      { reason: "RETURNED", quantity: "-1" },
      { reason: "ADJUSTMENT", quantity: "2" },
      { reason: "OPENING_BALANCE", quantity: "2" },
    ]) {
      expect(adjustmentSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });

  it("stores unit cost in cents and allows it to be unknown", () => {
    expect(
      variantSettingsSchema.parse({ variantId: "v", reorderPoint: "4", costCents: "12.345" }).costCents,
    ).toBe(1235);
    expect(
      variantSettingsSchema.parse({ variantId: "v", reorderPoint: "4", costCents: "" }).costCents,
    ).toBeNull();
    expect(
      variantSettingsSchema.safeParse({ variantId: "v", reorderPoint: "-1", costCents: "" }).success,
    ).toBe(false);
  });
});
