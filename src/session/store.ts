import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ModelMessage } from "ai";
import type { Session } from "./types";

export class SessionStore {
  private db: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        model TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)"
    );
  }

  save(session: Session): void {
    this.db.run(
      `INSERT OR REPLACE INTO sessions (id, agent, model, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.agent,
        session.model,
        session.title,
        session.createdAt,
        session.updatedAt,
      ]
    );
  }

  load(id: string): Session | null {
    const row = this.db
      .query(
        "SELECT id, agent, model, title, created_at, updated_at FROM sessions WHERE id = ?"
      )
      .get(id) as any;
    if (!row) return null;

    const msgRows = this.db
      .query(
        "SELECT role, content, parts, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp"
      )
      .all(id) as any[];

    const messages: ModelMessage[] = msgRows.map((r) => {
      if (r.parts) {
        const parts = JSON.parse(r.parts);
        return { role: r.role, content: parts } as ModelMessage;
      }
      return { role: r.role, content: r.content } as ModelMessage;
    });

    return {
      id: row.id,
      agent: row.agent,
      model: row.model,
      title: row.title,
      messages,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  list(): Session[] {
    const rows = this.db
      .query(
        "SELECT id, agent, model, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC"
      )
      .all() as any[];
    return rows.map((r) => ({
      id: r.id,
      agent: r.agent,
      model: r.model,
      title: r.title,
      messages: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  delete(id: string): void {
    this.db.run("DELETE FROM messages WHERE session_id = ?", [id]);
    this.db.run("DELETE FROM sessions WHERE id = ?", [id]);
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

    this.db.run(
      "INSERT INTO messages (id, session_id, role, content, parts, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [id, sessionId, message.role, content, parts, timestamp]
    );
    this.db.run("UPDATE sessions SET updated_at = ? WHERE id = ?", [
      timestamp,
      sessionId,
    ]);
  }
}
