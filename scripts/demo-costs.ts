/**
 * Gives the demo catalogue its fictional unit costs (the same ones the seed uses),
 * for databases seeded before costs existed. Only fills variants whose cost is
 * empty and whose SKU belongs to the demo catalogue, so real data is never touched.
 * Past orders keep no cost: margins only cover sales made after costs are known.
 *
 *   pnpm tsx scripts/demo-costs.ts
 *   sudo docker compose run --rm migrate pnpm tsx scripts/demo-costs.ts   # on the server
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { products, seedUnitCostCents } from "../prisma/seed-data";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  let updated = 0;
  for (const p of products) {
    for (const v of p.variants) {
      const { count } = await db.productVariant.updateMany({
        where: { sku: v.sku, costCents: null },
        data: { costCents: seedUnitCostCents(p.category, v.priceCents) },
      });
      updated += count;
    }
  }
  console.log(`set demo unit costs on ${updated} variants`);
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
