import { createClient } from "@libsql/client";
import { loadEnvConfig } from "@next/env";

function sanitizeEnvValue(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\r|\\n/g, "")
    .replace(/[\r\n]/g, "")
    .replace(/(%0d|%0a)/gi, "");
}

// Mirror Next.js env loading so migrations target the same DB as runtime.
loadEnvConfig(process.cwd());

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

    CREATE TABLE IF NOT EXISTS skv_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_id INTEGER REFERENCES moves(id),
      job_id TEXT NOT NULL,
      source_data TEXT,
      normalized_payload TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      message TEXT,
      remote INTEGER NOT NULL DEFAULT 0,
      clone_qr_enabled INTEGER NOT NULL DEFAULT 0,
      clone_qr_state_url TEXT,
      clone_qr_image_url TEXT,
      screenshot_path TEXT,
      details TEXT,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS skv_runs_job_id_idx
      ON skv_runs(job_id);
    CREATE INDEX IF NOT EXISTS skv_runs_created_at_idx
      ON skv_runs(created_at);
    CREATE INDEX IF NOT EXISTS skv_runs_move_id_idx
      ON skv_runs(move_id);
    CREATE INDEX IF NOT EXISTS skv_runs_status_updated_at_idx
      ON skv_runs(status, updated_at);

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      flow TEXT NOT NULL,
      route TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd TEXT,
      duration_ms INTEGER,
      ok INTEGER NOT NULL DEFAULT 1,
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS usage_events_provider_created_at_idx
      ON usage_events(provider, created_at);
    CREATE INDEX IF NOT EXISTS usage_events_flow_created_at_idx
      ON usage_events(flow, created_at);
    CREATE INDEX IF NOT EXISTS usage_events_route_created_at_idx
      ON usage_events(route, created_at);
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
  await ensureMoveColumn("ip_address");
  await ensureMoveColumn("has_children", "INTEGER NOT NULL DEFAULT 0");
  await ensureMoveColumn("user_agent");
  await ensureMoveColumn("ip_city");
  await ensureMoveColumn("ip_region");
  await ensureMoveColumn("ip_country");
  await ensureMoveColumn("ip_latitude");
  await ensureMoveColumn("ip_longitude");
  await ensureMoveColumn("from_municipality");
  await ensureMoveColumn("from_county");
  await ensureMoveColumn("from_latitude");
  await ensureMoveColumn("from_longitude");
  await ensureMoveColumn("to_municipality");
  await ensureMoveColumn("to_county");
  await ensureMoveColumn("to_latitude");
  await ensureMoveColumn("to_longitude");
  await ensureMoveColumn("enrichment_data");

  async function ensureUserColumn(columnName: string, sqlType = "TEXT") {
    const info = await client.execute("PRAGMA table_info(users)");
    const exists = info.rows.some(
      (row) => String((row as Record<string, unknown>).name) === columnName
    );
    if (!exists) {
      await client.execute(`ALTER TABLE users ADD COLUMN ${columnName} ${sqlType}`);
    }
  }

  await ensureUserColumn("first_name");
  await ensureUserColumn("last_name");

  async function ensureSkvRunColumn(columnName: string, sqlType = "TEXT") {
    const info = await client.execute("PRAGMA table_info(skv_runs)");
    const exists = info.rows.some(
      (row) => String((row as Record<string, unknown>).name) === columnName
    );
    if (!exists) {
      await client.execute(`ALTER TABLE skv_runs ADD COLUMN ${columnName} ${sqlType}`);
    }
  }

  await ensureSkvRunColumn("move_id", "INTEGER REFERENCES moves(id)");
  await ensureSkvRunColumn("job_id");
  await ensureSkvRunColumn("source_data");
  await ensureSkvRunColumn("normalized_payload");
  await ensureSkvRunColumn("status", "TEXT NOT NULL DEFAULT 'queued'");
  await ensureSkvRunColumn("message");
  await ensureSkvRunColumn("remote", "INTEGER NOT NULL DEFAULT 0");
  await ensureSkvRunColumn("clone_qr_enabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureSkvRunColumn("clone_qr_state_url");
  await ensureSkvRunColumn("clone_qr_image_url");
  await ensureSkvRunColumn("screenshot_path");
  await ensureSkvRunColumn("details");
  await ensureSkvRunColumn("started_at");
  await ensureSkvRunColumn("ended_at");
  await ensureSkvRunColumn("created_at");
  await ensureSkvRunColumn("updated_at");

  await client.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS skv_runs_job_id_idx ON skv_runs(job_id)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS skv_runs_created_at_idx ON skv_runs(created_at)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS skv_runs_move_id_idx ON skv_runs(move_id)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS skv_runs_status_updated_at_idx ON skv_runs(status, updated_at)"
  );

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