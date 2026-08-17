import { Pool, type PoolClient } from "pg";

/**
 * Shared PostgreSQL connection pool.
 *
 * This is the only place a raw `pg` Pool is constructed. Every package that needs
 * database access goes through this module (or the typed Drizzle schema in
 * `./schema`) rather than opening its own connection — see
 * docs/architecture/repository-structure.md.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — see .env.example");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
