/**
 * Applies prisma/migrations/*\/migration.sql to a database in order, recording
 * them in Prisma's _prisma_migrations table so `prisma migrate deploy` stays
 * compatible afterwards.
 *
 * Normal development uses `pnpm db:migrate` / `pnpm db:deploy`. This script
 * exists for environments that cannot download the Prisma migration engine
 * (some sandboxes) and for resetting the integration-test database.
 *
 *   tsx scripts/db-apply-migrations.ts [--reset] [connection-url]
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const url = args.find((a) => !a.startsWith("--")) ?? process.env.DATABASE_URL;
if (!url) throw new Error("No database URL given and DATABASE_URL is not set.");

const dir = join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (reset) {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  }
  await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
  const done = new Set(
    (
      await client.query<{ migration_name: string }>(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
      )
    ).rows.map((r) => r.migration_name),
  );
  for (const name of migrations) {
    if (done.has(name)) continue;
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ($1, $2, now(), $3, 1)`,
        [randomUUID(), checksum, name],
      );
      await client.query("COMMIT");
      console.log(`applied ${name}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
} finally {
  await client.end();
}
