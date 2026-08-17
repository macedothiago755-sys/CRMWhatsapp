#!/usr/bin/env tsx
/**
 * Minimal, dependency-light migration runner.
 *
 * Applies (or reverts) the SQL files in database/migrations/ in filename order,
 * tracking applied migrations in a `schema_migrations` table. This is the
 * canonical way schema changes reach any environment — see
 * docs/architecture/environment-strategy.md §3 (Migration safety): no manual
 * production schema edits, no destructive migration without explicit confirmation.
 *
 * Usage:
 *   tsx scripts/migrate.ts up      # apply all pending *.sql migrations
 *   tsx scripts/migrate.ts down    # revert the most recently applied migration
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "database", "migrations");

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

function listUpMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
}

async function up(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  const applied = new Set(
    (await pool.query<{ name: string }>("select name from public.schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );

  const pending = listUpMigrations().filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const file of pending) {
    console.log(`Applying ${file}...`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
      await client.query("COMMIT");
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${String(err)}`);
    } finally {
      client.release();
    }
  }
}

async function down(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  const result = await pool.query<{ name: string }>(
    "select name from public.schema_migrations order by applied_at desc limit 1",
  );
  const last = result.rows[0];
  if (!last) {
    console.log("No applied migrations to revert.");
    return;
  }

  const downFile = last.name.replace(/\.sql$/, ".down.sql");
  console.log(`Reverting ${last.name} via ${downFile}...`);
  const sql = readFileSync(join(MIGRATIONS_DIR, downFile), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("delete from public.schema_migrations where name = $1", [last.name]);
    await client.query("COMMIT");
    console.log(`  ✓ reverted ${last.name}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Revert of ${last.name} failed: ${String(err)}`);
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const direction = process.argv[2];
  if (direction !== "up" && direction !== "down") {
    console.error("Usage: tsx scripts/migrate.ts <up|down>");
    process.exit(1);
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("DATABASE_URL is not set — see .env.example");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  try {
    if (direction === "up") {
      await up(pool);
    } else {
      await down(pool);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
