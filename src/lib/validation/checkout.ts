import { z } from "zod";

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} is too long.`);

/**
 * We ship to mainland France and Corsica. Overseas departments (97xxx, 98xxx)
 * are excluded: different VAT and carriers, out of scope for this store.
 */
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Enter a 5-digit French postal code.")
  .refine((v) => !/^9[78]/.test(v), "We currently ship to mainland France and Corsica only.");

export const shippingAddressSchema = z.object({
  fullName: text("Full name", 100),
  line1: text("Address", 120),
  line2: z.string().trim().max(120).optional().transform((v) => v || undefined),
  postalCode: postalCodeSchema,
  city: text("City", 80),
  country: z.literal("FR", { error: "We currently ship to France only." }),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{6,20}$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const checkoutSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254),
  shippingMethod: z.enum(["STANDARD", "EXPRESS"], { error: "Choose a delivery method." }),
  address: shippingAddressSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

/** Flattens zod issues to `{ "address.postalCode": "message" }` for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}
