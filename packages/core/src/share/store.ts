import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { shares } from './schema';

// Co-resident with SessionStore over the same SQLite file: it takes
// SessionStore's drizzle handle (one connection, one writer) instead of
// opening its own — there is nothing here to close.
export class ShareStore {
  private db: ReturnType<typeof drizzle>;

  constructor(db: ReturnType<typeof drizzle>) {
    this.db = db;
    this.migrate();
  }

  private migrate(): void {
    this.db.run(/* sql */ `
      CREATE TABLE IF NOT EXISTS shares (
        session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
        token TEXT NOT NULL
      )
    `);
    this.db.run(/* sql */ `
      CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token)
    `);
  }

  // Generates an unguessable token for a session; re-sharing replaces the
  // old token (the old URL dies).
  create(sessionID: string): string {
    const token = randomBytes(32).toString('hex');
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
    const row = this.db.select().from(shares).where(eq(shares.token, token)).get();
    return row?.sessionId ?? null;
  }

  get(sessionID: string): string | null {
    const row = this.db.select().from(shares).where(eq(shares.sessionId, sessionID)).get();
    return row?.token ?? null;
  }
}
