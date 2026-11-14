import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (db) return db;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure a PostgreSQL connection string (see .env.example)."
    );
  }
  pool = new Pool({
    connectionString,
    ...(process.env.PG_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  db = drizzle(pool, { schema });
  return db;
}

export { getDb };
export { schema };
export type { schema as schemaType };

export async function withTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const database = getDb();
  return database.transaction(fn);
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
  db = null;
}
