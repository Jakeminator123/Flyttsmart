import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

function sanitizeEnvValue(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\r|\\n/g, "")
    .replace(/[\r\n]/g, "")
    .replace(/(%0d|%0a)/gi, "");
}

// Load .env.local since tsx doesn't do it automatically
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const url = process.env.TURSO_DATABASE_URL
  ? sanitizeEnvValue(process.env.TURSO_DATABASE_URL)
  : "file:./data/flytta.db";
const authToken = process.env.TURSO_AUTH_TOKEN
  ? sanitizeEnvValue(process.env.TURSO_AUTH_TOKEN)
  : undefined;

const client = createClient({
  url,
  authToken,
});

async function migrate() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      personal_number TEXT,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      from_street TEXT,
      from_postal TEXT,
      from_city TEXT,
      to_street TEXT,
      to_postal TEXT,
      to_city TEXT,
      apartment_number TEXT,
      property_designation TEXT,
      property_owner TEXT,
      move_date TEXT,
      household_type TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_id INTEGER NOT NULL REFERENCES moves(id),
      task_key TEXT,
      section_key TEXT,
      section TEXT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      need_help INTEGER NOT NULL DEFAULT 0,
      want_compare INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'todo',
      comparison_hints TEXT,
      category TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS qr_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      token_hash TEXT NOT NULL,
      encoded_data TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminder_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_id INTEGER NOT NULL REFERENCES moves(id),
      kind TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      email_to TEXT,
      provider TEXT NOT NULL,
      provider_message_id TEXT,
      subject TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS reminder_logs_move_kind_schedule_idx
      ON reminder_logs(move_id, kind, scheduled_for);
  `);

  async function ensureMoveColumn(columnName: string, sqlType = "TEXT") {
    const info = await client.execute("PRAGMA table_info(moves)");
    const exists = info.rows.some(
      (row) => String((row as Record<string, unknown>).name) === columnName
    );
    if (!exists) {
      await client.execute(`ALTER TABLE moves ADD COLUMN ${columnName} ${sqlType}`);
    }
  }

  await ensureMoveColumn("apartment_number");
  await ensureMoveColumn("property_designation");
  await ensureMoveColumn("property_owner");

  async function ensureChecklistColumn(columnName: string, sqlType = "TEXT") {
    const info = await client.execute("PRAGMA table_info(checklist_items)");
    const exists = info.rows.some(
      (row) => String((row as Record<string, unknown>).name) === columnName
    );
    if (!exists) {
      await client.execute(
        `ALTER TABLE checklist_items ADD COLUMN ${columnName} ${sqlType}`
      );
    }
  }

  await ensureChecklistColumn("task_key");
  await ensureChecklistColumn("section_key");
  await ensureChecklistColumn("section");
  await ensureChecklistColumn("need_help", "INTEGER NOT NULL DEFAULT 0");
  await ensureChecklistColumn("want_compare", "INTEGER NOT NULL DEFAULT 0");
  await ensureChecklistColumn("status", "TEXT NOT NULL DEFAULT 'todo'");
  await ensureChecklistColumn("comparison_hints");

  process.stdout.write(`Database migrated successfully at: ${url}\n`);
}

migrate().catch(console.error);