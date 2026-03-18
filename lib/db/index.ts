import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;

function sanitizeEnvValue(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\r|\\n/g, "")
    .replace(/[\r\n]/g, "")
    .replace(/(%0d|%0a)/gi, "");
}

function resolveDatabaseUrl() {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  const configuredUrl = rawUrl ? sanitizeEnvValue(rawUrl) : "";
  if (configuredUrl) return configuredUrl;

  // In local dev we allow a SQLite fallback.
  if (process.env.NODE_ENV !== "production") {
    return "file:./data/flytta.db";
  }

  throw new Error(
    "TURSO_DATABASE_URL is missing in production environment."
  );
}

export function getDb() {
  if (dbInstance) return dbInstance;

  const rawAuthToken = process.env.TURSO_AUTH_TOKEN;
  const authToken = rawAuthToken ? sanitizeEnvValue(rawAuthToken) : undefined;

  const client = createClient({
    url: resolveDatabaseUrl(),
    authToken,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

function toLibsqlStatement(db: ReturnType<typeof drizzle>, query: unknown): string | { sql: string; args: unknown[] } {
  if (typeof query === "string") return query;

  if (query && typeof query === "object") {
    const q = query as { sql?: unknown; args?: unknown; params?: unknown };
    if (typeof q.sql === "string") {
      if (Array.isArray(q.args)) return { sql: q.sql, args: q.args };
      if (Array.isArray(q.params)) return { sql: q.sql, args: q.params };
      return q.sql;
    }
  }

  const dialect = (db as unknown as { dialect?: { sqlToQuery?: (q: unknown) => unknown } }).dialect;
  if (dialect?.sqlToQuery) {
    const built = dialect.sqlToQuery(query) as { sql?: unknown; params?: unknown };
    if (typeof built?.sql === "string") {
      const args = Array.isArray(built.params) ? built.params : [];
      return { sql: built.sql, args };
    }
  }

  throw new Error("Unsupported SQL query format for runSql()");
}

/** Run raw SQL via the underlying LibSQL client (works for Drizzle sql`...` too). */
export async function runSql<T = unknown>(query: unknown): Promise<T[]> {
  const db = getDb();

  const client = (db as unknown as { $client?: { execute?: (q: unknown) => Promise<unknown> } }).$client;
  if (!client?.execute) {
    throw new Error("Database client does not support execute()");
  }

  const statement = toLibsqlStatement(db, query);
  const result = (await client.execute(statement)) as T[] | { rows?: T[] };
  if (Array.isArray(result)) return result;
  return (result as { rows?: T[] }).rows ?? [];
}

export { schema };