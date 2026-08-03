import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import type { Session } from "./types";
import { sessions, messages } from "./schema";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export class SessionStore {
  private db: ReturnType<typeof drizzle>;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.run("PRAGMA journal_mode = WAL");
    this.db = drizzle(sqlite);
    this.migrate(sqlite);
  }

  // ponytail: schema migration for v0.1.0 — drops old tables if schema
  // doesn't match. Fine for pre-release; add proper migrations when the
  // schema stabilizes.
  private migrate(sqlite: Database): void {
    const hasSeq = sqlite
      .query(
        "SELECT name FROM pragma_table_info('messages') WHERE name = 'seq'"
      )
      .get();
    const hasCwd = sqlite
      .query(
        "SELECT name FROM pragma_table_info('sessions') WHERE name = 'cwd'"
      )
      .get();
    const hasTokens = sqlite
      .query(
        "SELECT name FROM pragma_table_info('messages') WHERE name = 'tokens'"
      )
      .get();
    if (!hasSeq || !hasCwd || !hasTokens) {
      // Schema changed: drop and recreate. Data loss is acceptable pre-release.
      this.db.run("DROP TABLE IF EXISTS messages");
      this.db.run("DROP TABLE IF EXISTS sessions");
    }
    this.db.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        model TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        cwd TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.db.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens TEXT,
        seq INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
    this.db.run(
      /* sql */ "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq)"
    );
  }

  save(session: Session): void {
    this.db
      .insert(sessions)
      .values({
        id: session.id,
        agent: session.agent,
        model: session.model,
        title: session.title,
        cwd: session.cwd,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
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

  load(id: string): Session | null {
    const row = this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .get();
    if (!row) return null;

    const msgRows = this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(messages.seq)
      .all();

    const sessionMessages: ModelMessage[] = msgRows.map((r) => {
      const parsed = JSON.parse(r.content);
      return { role: r.role, content: parsed } as ModelMessage;
    });

    return {
      id: row.id,
      agent: row.agent,
      model: row.model,
      title: row.title,
      cwd: row.cwd,
      messages: sessionMessages,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  list(): Session[] {
    const rows = this.db
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
    }));
  }

  delete(id: string): void {
    this.db.delete(messages).where(eq(messages.sessionId, id)).run();
    this.db.delete(sessions).where(eq(sessions.id, id)).run();
  }

  appendMessage(
    sessionId: string,
    id: string,
    message: ModelMessage,
    timestamp: number,
    seq: number
  ): void {
    const content = JSON.stringify(message.content);

    this.db
      .insert(messages)
      .values({
        id,
        sessionId,
        role: message.role,
        content,
        seq,
        timestamp: new Date(timestamp),
      })
      .run();

    this.db
      .update(sessions)
      .set({ updatedAt: new Date(timestamp) })
      .where(eq(sessions.id, sessionId))
      .run();
  }

  // Persists token usage on a message row (the assistant message of a turn).
  setTokens(sessionId: string, seq: number, tokens: TokenUsage): void {
    this.db
      .update(messages)
      .set({ tokens: JSON.stringify(tokens) })
      .where(
        sql`${messages.sessionId} = ${sessionId} AND ${messages.seq} = ${seq}`
      )
      .run();
  }

  // Token usage of the most recent assistant message that has any, scanning
  // back past a possible mid-turn crash.
  lastUsage(sessionId: string): TokenUsage | null {
    const row = this.db
      .select({ tokens: messages.tokens })
      .from(messages)
      .where(
        sql`${messages.sessionId} = ${sessionId} AND ${messages.tokens} IS NOT NULL`
      )
      .orderBy(desc(messages.seq))
      .limit(1)
      .get();
    if (!row?.tokens) return null;
    return JSON.parse(row.tokens) as TokenUsage;
  }

  // Rewrites the session's message history wholesale, seq = index + 1.
  // Prune and compact mutate the in-memory message list and persist it here.
  // Token usage survives the rewrite (keyed by seq) so the overflow check
  // keeps working across compactions.
  // ponytail: per-message timestamps are write-only today (nothing reads them),
  // so rewritten rows get a fresh timestamp.
  replaceMessages(sessionId: string, messageList: ModelMessage[]): void {
    const now = Date.now();
    this.db.transaction((tx) => {
      const tokenRows = tx
        .select({ seq: messages.seq, tokens: messages.tokens })
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .all();
      const tokensBySeq = new Map(tokenRows.map((r) => [r.seq, r.tokens]));
      tx.delete(messages).where(eq(messages.sessionId, sessionId)).run();
      messageList.forEach((message, i) => {
        tx.insert(messages)
          .values({
            id: randomUUID(),
            sessionId,
            role: message.role,
            content: JSON.stringify(message.content),
            tokens: tokensBySeq.get(i + 1) ?? null,
            seq: i + 1,
            timestamp: new Date(now),
          })
          .run();
      });
      tx.update(sessions)
        .set({ updatedAt: new Date(now) })
        .where(eq(sessions.id, sessionId))
        .run();
    });
  }

  nextSeq(sessionId: string): number {
    const row = this.db
      .select({ maxSeq: sql<number>`coalesce(max(${messages.seq}), 0)` })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .get();
    return (row?.maxSeq ?? 0) + 1;
  }
}
