import { z } from "zod";

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "popular"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const PAGE_SIZE = 12;

/** Whole euros in the URL (?min=100&max=400), converted to cents for queries. */
const euros = z.coerce.number().int().min(0).max(100_000);

/**
 * Parses untrusted `searchParams` for listing pages. Invalid values are dropped
 * (not errors): a mistyped URL should still show products, not a 400 page.
 */
export const listingQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional()
    .catch(undefined),
  min: euros.optional().catch(undefined),
  max: euros.optional().catch(undefined),
  inStock: z
    .enum(["1"])
    .transform(() => true)
    .optional()
    .catch(undefined),
  sort: z.enum(SORT_OPTIONS).default("newest").catch("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

export type ListingQuery = z.infer<typeof listingQuerySchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseListingQuery(raw: RawSearchParams): ListingQuery {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
    if (flat[key] === "") flat[key] = undefined;
  }
  const parsed = listingQuerySchema.parse(flat);
  if (parsed.min !== undefined && parsed.max !== undefined && parsed.min > parsed.max) {
    [parsed.min, parsed.max] = [parsed.max, parsed.min];
  }
  return parsed;
}

/** Builds a listing URL, keeping only non-default values. */
export function listingHref(base: string, query: Partial<ListingQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.min !== undefined) params.set("min", String(query.min));
  if (query.max !== undefined) params.set("max", String(query.max));
  if (query.inStock) params.set("inStock", "1");
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
