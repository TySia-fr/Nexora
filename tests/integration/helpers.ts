import { randomUUID } from "node:crypto";
import { db } from "@/server/db";

export { db };

export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Integration tests need TEST_DATABASE_URL pointing at a *test* database (got ${new URL(url).pathname}).`);
  }
}

export async function resetDatabase() {
  assertTestDatabase();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;

export async function makeCategory(slug = `cat-${++counter}`) {
  return db.category.create({ data: { slug, name: slug, description: `${slug} things` } });
}

export async function makeProduct(opts: {
  categoryId: string;
  name?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  createdAt?: Date;
  unitsSold?: number;
  variants?: { priceCents: number; stock: number; isActive?: boolean; name?: string }[];
}) {
  const n = ++counter;
  const name = opts.name ?? `Product ${n}`;
  return db.product.create({
    data: {
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${n}`,
      name,
      tagline: "Test tagline",
      description: "Test description",
      categoryId: opts.categoryId,
      status: opts.status ?? "ACTIVE",
      unitsSold: opts.unitsSold ?? 0,
      createdAt: opts.createdAt,
      variants: {
        create: (opts.variants ?? [{ priceCents: 10000, stock: 10 }]).map((v, i) => ({
          sku: `SKU-${n}-${i}`,
          name: v.name ?? `Variant ${i}`,
          priceCents: v.priceCents,
          stock: v.stock,
          isActive: v.isActive ?? true,
          position: i,
        })),
      },
    },
    include: { variants: { orderBy: { position: "asc" } } },
  });
}

export async function makeUser(role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
  const id = randomUUID();
  return db.user.create({ data: { id, name: `User ${id.slice(0, 4)}`, email: `${id}@example.test`, role } });
}

export const validCheckout = (over: Record<string, unknown> = {}) => ({
  email: "buyer@example.com",
  shippingMethod: "STANDARD",
  address: {
    fullName: "Camille Roux",
    line1: "12 rue de l'Exemple",
    postalCode: "34000",
    city: "Montpellier",
    country: "FR",
  },
  ...over,
});
