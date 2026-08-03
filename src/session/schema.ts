import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  agent: text("agent").notNull(),
  model: text("model").notNull(),
  title: text("title").notNull().default(""),
  cwd: text("cwd").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    tokens: text("tokens"),
    seq: integer("seq").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("idx_messages_session").on(t.sessionId, t.seq)]
);
