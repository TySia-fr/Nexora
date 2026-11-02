import { z } from "zod";

const id = z.string().trim().min(1).max(40);
const note = z
  .string()
  .trim()
  .max(200, "Keep the note under 200 characters.")
  .optional()
  .transform((v) => v || null);

export const INVENTORY_LEVELS = ["all", "out", "low", "ok", "inactive"] as const;
export const INVENTORY_SORTS = ["urgency", "name", "available", "sold", "value"] as const;

export const inventoryFilterSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional()
    .catch(undefined),
  level: z.enum(INVENTORY_LEVELS).default("all").catch("all"),
  sort: z.enum(INVENTORY_SORTS).default("urgency").catch("urgency"),
});
export type InventoryFilter = z.infer<typeof inventoryFilterSchema>;

/** Reasons an admin can choose by hand; the others are written by the system. */
export const MANUAL_REASONS = ["RECEIVED", "RETURNED", "DAMAGED", "ADJUSTMENT"] as const;
export type ManualReason = (typeof MANUAL_REASONS)[number];

export const adjustmentSchema = z
  .object({
    variantId: id,
    reason: z.enum(MANUAL_REASONS, { error: "Choose a reason." }),
    /** Units. Received/returned add, damaged removes; adjustments take a sign. */
    quantity: z.coerce
      .number({ error: "Enter a number." })
      .int("Whole units only.")
      .refine((n) => n !== 0, "Enter a non-zero quantity.")
      .refine((n) => Math.abs(n) <= 10_000, "That is more than 10,000 units."),
    note,
  })
  .superRefine((v, ctx) => {
    if ((v.reason === "RECEIVED" || v.reason === "RETURNED" || v.reason === "DAMAGED") && v.quantity < 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter a positive number of units." });
    }
    if (v.reason === "ADJUSTMENT" && !v.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Say why the stock is being corrected." });
    }
  })
  .transform((v) => ({
    variantId: v.variantId,
    reason: v.reason,
    note: v.note,
    delta: v.reason === "DAMAGED" ? -v.quantity : v.quantity,
  }));

const euros = z
  .union([z.literal(""), z.coerce.number({ error: "Enter an amount in euros." })])
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (v >= 0 && v <= 100_000), "Enter an amount between 0 and 100,000.")
  .transform((v) => (v === null ? null : Math.round(v * 100)));

export const variantSettingsSchema = z.object({
  variantId: id,
  reorderPoint: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole units only.")
    .min(0, "Can't be negative.")
    .max(10_000),
  /** Unit cost in euros excluding VAT; empty means unknown. */
  costCents: euros,
});

export const openCountSchema = z.object({
  categoryId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  note,
});

/** Counted quantities keyed by line id; an empty field leaves the line uncounted. */
export const countEntriesSchema = z.object({
  countId: id,
  entries: z
    .array(
      z.object({
        lineId: id,
        counted: z
          .union([
            z.literal(""),
            z.coerce.number().int("Whole units only.").min(0, "Can't be negative.").max(100_000),
          ])
          .transform((v) => (v === "" ? null : v)),
      }),
    )
    .max(2000),
});

export const ANALYTICS_RANGES = [7, 30, 90, 365] as const;
export const analyticsRangeSchema = z.coerce
  .number()
  .refine((n): n is (typeof ANALYTICS_RANGES)[number] => (ANALYTICS_RANGES as readonly number[]).includes(n))
  .catch(30);
