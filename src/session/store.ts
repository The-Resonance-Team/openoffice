import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, desc } from "drizzle-orm";
import type { ModelMessage } from "ai";
import type { Session } from "./types";
import { sessions, messages } from "./schema";

export class SessionStore {
  private db: ReturnType<typeof drizzle>;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.run("PRAGMA journal_mode = WAL");
    this.db = drizzle(sqlite);
    this.db.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        model TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
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
        parts TEXT,
        timestamp INTEGER NOT NULL
      )
    `);
    this.db.run(
      /* sql */ "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)"
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
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          agent: session.agent,
          model: session.model,
          title: session.title,
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
      .orderBy(messages.timestamp)
      .all();

    const sessionMessages: ModelMessage[] = msgRows.map((r) => {
      if (r.parts) {
        return { role: r.role, content: JSON.parse(r.parts) } as ModelMessage;
      }
      return { role: r.role, content: r.content } as ModelMessage;
    });

    return {
      id: row.id,
      agent: row.agent,
      model: row.model,
      title: row.title,
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
    timestamp: number
  ): void {
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    const parts =
      typeof message.content === "string"
        ? null
        : JSON.stringify(message.content);

    this.db
      .insert(messages)
      .values({
        id,
        sessionId,
        role: message.role,
        content,
        parts,
        timestamp: new Date(timestamp),
      })
      .run();

    this.db
      .update(sessions)
      .set({ updatedAt: new Date(timestamp) })
      .where(eq(sessions.id, sessionId))
      .run();
  }
}
