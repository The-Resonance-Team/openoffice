import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { shares } from "./schema";

export class ShareStore {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.run("PRAGMA journal_mode = WAL");
    sqlite.run("PRAGMA foreign_keys = ON");
    this.db = drizzle(sqlite);
    this.sqlite = sqlite;
    this.migrate(sqlite);
  }

  close(): void {
    this.sqlite.close();
  }

  private migrate(sqlite: Database): void {
    sqlite.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS shares (
        session_id TEXT PRIMARY KEY REFERENCES sessions(id),
        token TEXT NOT NULL
      )
    `);
    sqlite.run(/* sql */ `
      CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token)
    `);
  }

  // Generates an unguessable token for a session; re-sharing replaces the
  // old token (the old URL dies).
  create(sessionID: string): string {
    const token = randomBytes(32).toString("hex");
    this.db
      .insert(shares)
      .values({ sessionId: sessionID, token })
      .onConflictDoUpdate({
        target: shares.sessionId,
        set: { token },
      })
      .run();
    return token;
  }

  revoke(sessionID: string): void {
    this.db.delete(shares).where(eq(shares.sessionId, sessionID)).run();
  }

  findByToken(token: string): string | null {
    const row = this.db
      .select()
      .from(shares)
      .where(eq(shares.token, token))
      .get();
    return row?.sessionId ?? null;
  }

  get(sessionID: string): string | null {
    const row = this.db
      .select()
      .from(shares)
      .where(eq(shares.sessionId, sessionID))
      .get();
    return row?.token ?? null;
  }
}
