import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
  .max(80);

/** Euros typed by a person ("349", "349.9", "349,90") to integer cents. */
export const eurosToCents = z
  .string()
  .trim()
  .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Enter a price like 349 or 349.90.")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100));

/** "Label: value" per line. */
export const pairLines = (first: string, second: string) =>
  z
    .string()
    .max(5000)
    .transform((text, ctx) => {
      const out: Record<string, string>[] = [];
      for (const [i, raw] of text.split("\n").entries()) {
        const line = raw.trim();
        if (!line) continue;
        const at = line.indexOf(":");
        if (at < 1 || at === line.length - 1) {
          ctx.addIssue({ code: "custom", message: `Line ${i + 1} needs the form "${first}: ${second}".` });
          return z.NEVER;
        }
        out.push({ [first]: line.slice(0, at).trim(), [second]: line.slice(at + 1).trim() });
      }
      return out;
    });

export const variantSchema = z.object({
  id: z.string().max(64).optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, "SKU: 3–40 letters, numbers or dashes."),
  name: z.string().trim().min(1, "Variant name is required.").max(60),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Colour must look like #2A2A2F.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  price: eurosToCents,
  stock: z.coerce
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock can't be negative.")
    .max(100_000),
  isActive: z.boolean(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug,
  tagline: z.string().trim().min(1, "Tagline is required.").max(80),
  description: z.string().trim().min(1, "Description is required.").max(2000),
  categoryId: z.string().min(1, "Choose a category.").max(64),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  featured: z.boolean(),
  specs: pairLines("label", "value"),
  features: pairLines("title", "body"),
  variants: z.array(variantSchema).min(1, "Add at least one variant.").max(30),
});
export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  slug,
  description: z.string().trim().min(1, "Description is required.").max(400),
  position: z.coerce.number().int().min(0).max(999),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, numbers, dashes or underscores."),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.string().trim().min(1, "Enter a value."),
    minSubtotal: z.string().trim().optional(),
    categoryId: z
      .string()
      .max(64)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    maxRedemptions: z.string().optional(),
  })
  .transform((v, ctx) => {
    const num = (s: string | undefined) => (s ? Number(s.replace(",", ".")) : undefined);
    const value = v.type === "PERCENT" ? Number(v.value) : Math.round((num(v.value) ?? Number.NaN) * 100);
    if (!Number.isInteger(value) || value <= 0 || (v.type === "PERCENT" && value > 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          v.type === "PERCENT"
            ? "Percent must be a whole number from 1 to 100."
            : "Enter an amount in euros.",
      });
      return z.NEVER;
    }
    const minSubtotalCents = v.minSubtotal ? Math.round((num(v.minSubtotal) ?? 0) * 100) : 0;
    if (!Number.isInteger(minSubtotalCents) || minSubtotalCents < 0) {
      ctx.addIssue({ code: "custom", path: ["minSubtotal"], message: "Enter an amount in euros." });
      return z.NEVER;
    }
    const date = (s: string | undefined, path: string) => {
      if (!s) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", path: [path], message: "Enter a valid date." });
        return null;
      }
      return d;
    };
    const startsAt = date(v.startsAt, "startsAt");
    const endsAt = date(v.endsAt, "endsAt");
    if (startsAt && endsAt && endsAt <= startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start." });
    }
    const maxRedemptions = v.maxRedemptions ? Number(v.maxRedemptions) : null;
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["maxRedemptions"],
        message: "Enter a whole number, or leave empty.",
      });
    }
    return {
      code: v.code,
      type: v.type,
      value,
      minSubtotalCents,
      categoryId: v.categoryId ?? null,
      startsAt,
      endsAt,
      maxRedemptions,
    };
  });
