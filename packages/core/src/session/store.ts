import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type {
  Session,
  Todo,
  TodoPriority,
  TodoStatus,
} from "@openoffice/schema";
import { sessions, messages, parts, sessionTodos } from "./schema";
import type {
  MessageInfo,
  Part,
  TextPart,
  ToolPart,
  CompactionPart,
  WithParts,
} from "./parts";

const parse = <T>(value: string | null): T | undefined =>
  value ? (JSON.parse(value) as T) : undefined;

function infoToRow(info: MessageInfo, sessionId: string, seq: number) {
  return {
    id: info.id,
    sessionId,
    role: info.role,
    parentId: info.parentID ?? null,
    agent: info.agent ?? null,
    model: info.model ? JSON.stringify(info.model) : null,
    summary: info.summary ?? false,
    finish: info.finish ?? null,
    error: info.error ? JSON.stringify(info.error) : null,
    tokens: info.tokens ? JSON.stringify(info.tokens) : null,
    seq,
    timestamp: new Date(info.time.created),
  };
}

function rowToInfo(row: {
  id: string;
  role: string;
  parentId: string | null;
  agent: string | null;
  model: string | null;
  summary: boolean;
  finish: string | null;
  error: string | null;
  tokens: string | null;
  timestamp: Date;
}): MessageInfo {
  return {
    id: row.id,
    role: row.role as MessageInfo["role"],
    parentID: row.parentId ?? undefined,
    agent: row.agent ?? undefined,
    model: parse<MessageInfo["model"]>(row.model),
    summary: row.summary || undefined,
    finish: (row.finish as MessageInfo["finish"]) ?? undefined,
    error: parse<{ message: string }>(row.error),
    tokens: parse<MessageInfo["tokens"]>(row.tokens),
    time: { created: row.timestamp.getTime() },
  };
}

function partToRow(part: Part, sessionId: string, timestamp: number) {
  const row: {
    id: string;
    messageId: string;
    sessionId: string;
    type: string;
    tool: string | null;
    callId: string | null;
    text: string | null;
    state: string | null;
    time: string | null;
    timestamp: Date;
  } = {
    id: part.id ?? "",
    messageId: part.messageID ?? "",
    sessionId,
    type: part.type,
    tool: null,
    callId: null,
    text: null,
    state: null,
    time: part.time ? JSON.stringify(part.time) : null,
    timestamp: new Date(timestamp),
  };
  if (part.type === "text") {
    row.text = part.text;
  }
  if (part.type === "tool") {
    row.tool = part.tool;
    row.callId = part.callID ?? null;
    row.state = JSON.stringify(part.state);
  }
  return row;
}

function rowToPart(row: {
  id: string;
  messageId: string;
  type: string;
  tool: string | null;
  callId: string | null;
  text: string | null;
  state: string | null;
  time: string | null;
}): Part {
  const base = { id: row.id, messageID: row.messageId };
  const time = parse<Part["time"]>(row.time);
  if (row.type === "text") {
    const part: TextPart = { ...base, type: "text", text: row.text ?? "" };
    if (time) part.time = time;
    return part;
  }
  if (row.type === "compaction") {
    const part: CompactionPart = {
      ...base,
      type: "compaction",
      auto: false,
      overflow: false,
    };
    if (time) part.time = time;
    return part;
  }
  const part: ToolPart = {
    ...base,
    type: "tool",
    tool: row.tool ?? "",
    callID: row.callId ?? undefined,
    state: parse<Record<string, unknown>>(row.state) as ToolPart["state"],
  };
  if (time) part.time = time;
  return part;
}

export class SessionStore {
  private drizzle: ReturnType<typeof drizzle>;
  private sqlite: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.run("PRAGMA journal_mode = WAL");
    sqlite.run("PRAGMA foreign_keys = ON");
    this.drizzle = drizzle(sqlite);
    this.sqlite = sqlite;
    this.migrate(sqlite);
  }

  close(): void {
    this.sqlite.close();
  }

  // The drizzle handle, shared with co-resident stores over the same SQLite
  // file (ShareStore) — one connection, one writer.
  get db(): ReturnType<typeof drizzle> {
    return this.drizzle;
  }

  // ponytail: schema migration for v0.1.0 — drops old tables if schema
  // doesn't match. Fine for pre-release; add proper migrations when the
  // schema stabilizes.
  private migrate(sqlite: Database): void {
    const hasParent = sqlite
      .query(
        "SELECT name FROM pragma_table_info('messages') WHERE name = 'parent_id'"
      )
      .get();
    const hasEndedAt = sqlite
      .query(
        "SELECT name FROM pragma_table_info('sessions') WHERE name = 'ended_at'"
      )
      .get();
    const hasLastActiveAt = sqlite
      .query(
        "SELECT name FROM pragma_table_info('sessions') WHERE name = 'last_active_at'"
      )
      .get();
    if (!hasParent || !hasEndedAt || !hasLastActiveAt) {
      this.drizzle.run("DROP TABLE IF EXISTS parts");
      this.drizzle.run("DROP TABLE IF EXISTS messages");
      this.drizzle.run("DROP TABLE IF EXISTS session_todos");
      this.drizzle.run("DROP TABLE IF EXISTS sessions");
    }
    this.drizzle.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        model TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        cwd TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        ended_at INTEGER,
        last_active_at INTEGER
      )
    `);
    this.drizzle.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        parent_id TEXT,
        agent TEXT,
        model TEXT,
        summary INTEGER NOT NULL DEFAULT 0,
        finish TEXT,
        error TEXT,
        tokens TEXT,
        seq INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
    this.drizzle.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS parts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id),
        session_id TEXT NOT NULL REFERENCES sessions(id),
        type TEXT NOT NULL,
        tool TEXT,
        call_id TEXT,
        text TEXT,
        state TEXT,
        time TEXT,
        timestamp INTEGER NOT NULL
      )
    `);
    this.drizzle.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS session_todos (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL
      )
    `);
    this.drizzle.run(
      /* sql */ "CREATE INDEX IF NOT EXISTS idx_todos_session ON session_todos(session_id, position)"
    );
    this.drizzle.run(
      /* sql */ "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq)"
    );
    this.drizzle.run(
      /* sql */ "CREATE INDEX IF NOT EXISTS idx_parts_message ON parts(message_id)"
    );
    this.drizzle.run(
      /* sql */ "CREATE INDEX IF NOT EXISTS idx_parts_session ON parts(session_id)"
    );
  }

  save(session: Session): void {
    this.drizzle
      .insert(sessions)
      .values({
        id: session.id,
        agent: session.agent,
        model: session.model,
        title: session.title,
        cwd: session.cwd,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
        lastActiveAt: session.lastActiveAt
          ? new Date(session.lastActiveAt)
          : null,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          agent: session.agent,
          model: session.model,
          title: session.title,
          cwd: session.cwd,
          updatedAt: new Date(session.updatedAt),
        },
      })
      .run();
  }

  /**
   * Atomically claims the session end: only the first caller sees ended_at
   * transition null → set. Returns whether this call won the claim.
   */
  markEnded(id: string, endedAt: number): boolean {
    const result = this.sqlite
      .query(
        "UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL"
      )
      .run(endedAt, id);
    return result.changes > 0;
  }

  load(id: string): Session | null {
    const row = this.drizzle
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .get();
    if (!row) return null;

    return {
      id: row.id,
      agent: row.agent,
      model: row.model,
      title: row.title,
      cwd: row.cwd,
      messages: this.messages(id),
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      endedAt: row.endedAt ? row.endedAt.getTime() : undefined,
      lastActiveAt: row.lastActiveAt ? row.lastActiveAt.getTime() : undefined,
    };
  }

  list(): Session[] {
    const rows = this.drizzle
      .select()
      .from(sessions)
      .orderBy(desc(sessions.updatedAt))
      .all();
    return rows.map((r) => ({
      id: r.id,
      agent: r.agent,
      model: r.model,
      title: r.title,
      cwd: r.cwd,
      messages: [],
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
      endedAt: r.endedAt ? r.endedAt.getTime() : undefined,
      lastActiveAt: r.lastActiveAt ? r.lastActiveAt.getTime() : undefined,
    }));
  }

  delete(id: string): void {
    this.drizzle.delete(parts).where(eq(parts.sessionId, id)).run();
    this.drizzle.delete(messages).where(eq(messages.sessionId, id)).run();
    this.drizzle.delete(sessions).where(eq(sessions.id, id)).run();
  }

  // Full message history of a session, chronological, parts in insertion order.
  messages(sessionId: string): WithParts[] {
    const msgRows = this.drizzle
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.seq)
      .all();
    const partRows = this.drizzle
      .select()
      .from(parts)
      .where(eq(parts.sessionId, sessionId))
      .orderBy(sql`rowid`)
      .all();
    const partsByMessage = new Map<string, Part[]>();
    for (const row of partRows) {
      const list = partsByMessage.get(row.messageId) ?? [];
      list.push(rowToPart(row));
      partsByMessage.set(row.messageId, list);
    }
    return msgRows.map((row) => ({
      info: rowToInfo(row),
      parts: partsByMessage.get(row.id) ?? [],
    }));
  }

  // Upserts a message row; seq auto-increments within the session.
  updateMessage(sessionId: string, info: MessageInfo): void {
    const seq = info.id
      ? this.drizzle
          .select({ seq: messages.seq })
          .from(messages)
          .where(sql`${messages.id} = ${info.id}`)
          .get()
      : undefined;
    const next = seq?.seq ?? this.nextSeq(sessionId);
    this.drizzle
      .insert(messages)
      .values(infoToRow(info, sessionId, next))
      .onConflictDoUpdate({
        target: messages.id,
        set: infoToRow(info, sessionId, next),
      })
      .run();
    this.touch(sessionId, info.time.created);
  }

  // Upserts a part row. Returns the part id (assigned server-side on insert)
  // so callers can target the row later, e.g. updating a pending tool-call
  // part once its result arrives.
  updatePart(sessionId: string, messageId: string, part: Part): string {
    const id = part.id ?? randomUUID();
    const row = partToRow(
      { ...part, id, messageID: messageId },
      sessionId,
      Date.now()
    );
    this.drizzle
      .insert(parts)
      .values(row)
      .onConflictDoUpdate({ target: parts.id, set: row })
      .run();
    this.touch(sessionId, Date.now());
    return id;
  }

  nextSeq(sessionId: string): number {
    const row = this.drizzle
      .select({ maxSeq: sql<number>`coalesce(max(${messages.seq}), 0)` })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .get();
    return (row?.maxSeq ?? 0) + 1;
  }

  /** The session's todo list, in position order. */
  getTodos(sessionId: string): Todo[] {
    const rows = this.drizzle
      .select()
      .from(sessionTodos)
      .where(eq(sessionTodos.sessionId, sessionId))
      .orderBy(sessionTodos.position)
      .all();
    return rows.map((row) => ({
      content: row.content,
      status: row.status as TodoStatus,
      priority: row.priority as TodoPriority,
    }));
  }

  /** Replace-on-write: deletes the session's todos, then inserts the new list. */
  setTodos(sessionId: string, todos: Todo[]): void {
    this.drizzle.transaction((tx) => {
      tx.delete(sessionTodos)
        .where(eq(sessionTodos.sessionId, sessionId))
        .run();
      todos.forEach((todo, position) => {
        tx.insert(sessionTodos)
          .values({
            sessionId,
            position,
            content: todo.content,
            status: todo.status,
            priority: todo.priority,
          })
          .run();
      });
    });
    this.touch(sessionId, Date.now());
  }

  private touch(sessionId: string, at: number): void {
    this.drizzle
      .update(sessions)
      .set({ updatedAt: new Date(at), lastActiveAt: new Date(at) })
      .where(eq(sessions.id, sessionId))
      .run();
  }
}
