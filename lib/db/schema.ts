import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ── Users ──────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  personalNumber: text("personal_number"), // encrypted / hashed
  email: text("email"),
  phone: text("phone"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Moves ──────────────────────────────────────────────────────────────
export const moves = sqliteTable("moves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  fromStreet: text("from_street"),
  fromPostal: text("from_postal"),
  fromCity: text("from_city"),
  toStreet: text("to_street"),
  toPostal: text("to_postal"),
  toCity: text("to_city"),
  apartmentNumber: text("apartment_number"),
  propertyDesignation: text("property_designation"),
  propertyOwner: text("property_owner"),
  moveDate: text("move_date"), // ISO date string
  householdType: text("household_type"), // "myself" | "family" | "partner" | "child"
  reason: text("reason"),
  hasChildren: integer("has_children", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("draft"), // draft | submitted | confirmed | completed
  ipAddress: text("ip_address"),
  ipCity: text("ip_city"),
  ipRegion: text("ip_region"),
  ipCountry: text("ip_country"),
  ipLatitude: text("ip_latitude"),
  ipLongitude: text("ip_longitude"),
  userAgent: text("user_agent"),
  fromMunicipality: text("from_municipality"),
  fromCounty: text("from_county"),
  fromLatitude: text("from_latitude"),
  fromLongitude: text("from_longitude"),
  toMunicipality: text("to_municipality"),
  toCounty: text("to_county"),
  toLatitude: text("to_latitude"),
  toLongitude: text("to_longitude"),
  enrichmentData: text("enrichment_data"), // JSON blob with full API responses
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Checklist Items ────────────────────────────────────────────────────
export const checklistItems = sqliteTable("checklist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  moveId: integer("move_id")
    .notNull()
    .references(() => moves.id),
  taskKey: text("task_key"),
  sectionKey: text("section_key"),
  section: text("section"),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  needHelp: integer("need_help", { mode: "boolean" }).notNull().default(false),
  wantCompare: integer("want_compare", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("todo"), // todo | in_progress | done
  comparisonHints: text("comparison_hints"), // JSON-encoded string[]
  category: text("category"), // administration | practical | children | cleaning | post_move
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── QR Tokens ──────────────────────────────────────────────────────────
export const qrTokens = sqliteTable("qr_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  encodedData: text("encoded_data").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Reminder Logs ───────────────────────────────────────────────────────
export const reminderLogs = sqliteTable(
  "reminder_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    moveId: integer("move_id")
      .notNull()
      .references(() => moves.id),
    kind: text("kind").notNull(), // e.g. due_soon
    scheduledFor: text("scheduled_for").notNull(), // YYYY-MM-DD
    emailTo: text("email_to"),
    provider: text("provider").notNull(), // resend | sendgrid | dry_run
    providerMessageId: text("provider_message_id"),
    subject: text("subject"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    moveKindScheduleUnique: uniqueIndex("reminder_logs_move_kind_schedule_idx").on(
      table.moveId,
      table.kind,
      table.scheduledFor
    ),
  })
);

// ── Usage Events (cost/tokens tracking) ────────────────────────────────
export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(), // openai | brave | pap | eniro | nominatim | scb | ratsit | openclaw_gateway | elpris
    flow: text("flow").notNull(), // web_search | enrichment | comparison | gateway_simple | gateway_general | gateway_comparison | keepalive
    route: text("route").notNull(), // /api/did/chat, /api/openclaw/chat, etc
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCostUsd: text("estimated_cost_usd"), // stored as string, ex: "0.0032"
    durationMs: integer("duration_ms"),
    ok: integer("ok", { mode: "boolean" }).notNull().default(true),
    sessionId: text("session_id"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    providerCreatedAtIdx: index("usage_events_provider_created_at_idx").on(
      table.provider,
      table.createdAt,
    ),
    flowCreatedAtIdx: index("usage_events_flow_created_at_idx").on(
      table.flow,
      table.createdAt,
    ),
    routeCreatedAtIdx: index("usage_events_route_created_at_idx").on(
      table.route,
      table.createdAt,
    ),
  }),
);

// ── Type helpers ───────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Move = typeof moves.$inferSelect;
export type NewMove = typeof moves.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type QrToken = typeof qrTokens.$inferSelect;
export type NewQrToken = typeof qrTokens.$inferInsert;
export type ReminderLog = typeof reminderLogs.$inferSelect;
export type NewReminderLog = typeof reminderLogs.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
