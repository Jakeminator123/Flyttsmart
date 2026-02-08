import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
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

// ── Type helpers ───────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Move = typeof moves.$inferSelect;
export type NewMove = typeof moves.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type QrToken = typeof qrTokens.$inferSelect;
export type NewQrToken = typeof qrTokens.$inferInsert;
