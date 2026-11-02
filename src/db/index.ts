import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

// Reuse the pool across hot reloads in development.
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres>; __db?: DB };

/** Created on first use so builds (no DATABASE_URL) never need a database. */
function getDb(): DB {
  if (g.__db) return g.__db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = g.__pg ?? postgres(url, { max: 10, idle_timeout: 20, prepare: true });
  g.__pg = client;
  g.__db = drizzle(client, { schema });
  return g.__db;
}

export const db = new Proxy({} as DB, {
  get: (_t, prop) => {
    const real = getDb();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
export { schema };
