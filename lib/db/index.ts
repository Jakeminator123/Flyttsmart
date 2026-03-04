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

/** Run raw SQL. LibSQL driver supports this at runtime; types may not expose it. */
export async function runSql<T = unknown>(query: unknown): Promise<T[]> {
  const db = getDb();
  const result = (await (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(query)) as
    | T[]
    | { rows: T[] };
  if (Array.isArray(result)) return result;
  return (result as { rows: T[] }).rows ?? [];
}

export { schema };