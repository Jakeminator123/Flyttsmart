import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// ── Users ──────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
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
  status: text("status").notNull().default("draft"), // draft | submitted | confirmed | completed
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
