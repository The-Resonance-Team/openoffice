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

// Message rows: one per WithParts.info. Part payloads (text, tool state) live
// in `parts`; JSON columns hold optional structured fields.
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    role: text("role").notNull(),
    parentId: text("parent_id"),
    agent: text("agent"),
    model: text("model"),
    summary: integer("summary", { mode: "boolean" }).notNull().default(false),
    finish: text("finish"),
    error: text("error"),
    tokens: text("tokens"),
    seq: integer("seq").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("idx_messages_session").on(t.sessionId, t.seq)]
);

export const parts = sqliteTable(
  "parts",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    type: text("type").notNull(),
    tool: text("tool"),
    callId: text("call_id"),
    text: text("text"),
    state: text("state"),
    time: text("time"),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("idx_parts_message").on(t.messageId),
    index("idx_parts_session").on(t.sessionId),
  ]
);
