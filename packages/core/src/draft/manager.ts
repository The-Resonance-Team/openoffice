import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import type { HistoryStore } from "../history";
import { LockManager } from "./lock";

export function filePathHash(file: string): string {
  return createHash("sha256").update(file).digest("hex");
}

export interface DraftMeta {
  sessionID: string;
  realFilePath: string;
  filePathHash: string;
  extension: string;
  createdAt: number;
  status: "active" | "orphaned";
}

export interface DraftManagerDeps {
  dataDir: string;
  now?: () => number;
  staleAfterMs?: number;
  askUser?: (question: string, sessionID: string) => Promise<string>;
  execOfficeCli: (
    args: string[]
  ) => Promise<{ stdout: string; exitCode: number }>;
  history: HistoryStore;
}

export type ResolveResult = { path?: string; lockError?: string };

export type AcceptResult = { ok: true } | { ok: false; error: string };

export const LOCKED_ERROR = "File is being edited in another session";

interface DraftRef {
  file: string;
  meta: DraftMeta;
}

export class DraftManager {
  private locks: LockManager;
  private now: () => number;
  private staleAfterMs: number;

  constructor(private deps: DraftManagerDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.staleAfterMs = deps.staleAfterMs ?? 24 * 60 * 60 * 1000;
    this.locks = new LockManager(deps.dataDir, this.staleAfterMs, this.now);
  }

  get history(): HistoryStore {
    return this.deps.history;
  }

  private draftDir(hash: string): string {
    return join(this.deps.dataDir, "drafts", hash);
  }

  private draftFile(
    hash: string,
    sessionID: string,
    extension: string
  ): string {
    return join(this.draftDir(hash), `${sessionID}${extension}`);
  }

  private metaPath(file: string): string {
    return `${file}.meta.json`;
  }

  private readMeta(file: string): DraftMeta | null {
    const path = this.metaPath(file);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as DraftMeta;
    } catch {
      return null;
    }
  }

  private writeMeta(meta: DraftMeta, draftFile: string): void {
    writeFileSync(this.metaPath(draftFile), JSON.stringify(meta));
  }

  private async flush(file: string): Promise<boolean> {
    try {
      const res = await this.deps.execOfficeCli(["close", file]);
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Resolve the path a command should operate on: the draft for mutating
   * verbs (and open/create), the draft for reads once one exists, else the
   * real file. Locked-out sessions get { lockError }.
   */
  async resolve(
    file: string,
    sessionID: string,
    createsDraft: boolean
  ): Promise<ResolveResult> {
    const hash = filePathHash(file);
    const extension = extname(file).toLowerCase();
    const draftFile = this.draftFile(hash, sessionID, extension);

    if (createsDraft) {
      if (!existsSync(draftFile)) {
        await this.handleOrphans(file, sessionID);
        const acquired = this.locks.acquire(hash, sessionID);
        if (!acquired.ok) return { lockError: LOCKED_ERROR };
        if (acquired.overridden) {
          this.orphanDraftOf(hash, acquired.overridden.sessionID);
        }
        if (existsSync(file)) {
          mkdirSync(dirname(draftFile), { recursive: true });
          copyFileSync(file, draftFile);
        } else {
          mkdirSync(dirname(draftFile), { recursive: true });
          writeFileSync(draftFile, "");
        }
        this.writeMeta(
          {
            sessionID,
            realFilePath: file,
            filePathHash: hash,
            extension,
            createdAt: this.now(),
            status: "active",
          },
          draftFile
        );
      } else {
        const acquired = this.locks.acquire(hash, sessionID);
        if (!acquired.ok) return { lockError: LOCKED_ERROR };
      }
      return { path: draftFile };
    }

    if (existsSync(draftFile)) {
      return { path: draftFile };
    }
    await this.handleOrphans(file, sessionID);
    return { path: file };
  }

  async accept(sessionID: string, file: string): Promise<AcceptResult> {
    const draft = this.findDraft(file, sessionID);
    if (!draft) return { ok: false, error: "No draft for this session" };
    return this.acceptDraft(draft);
  }

  private removeDraft(file: string, hash: string): void {
    rmSync(file, { force: true });
    rmSync(this.metaPath(file), { force: true });
    const dir = this.draftDir(hash);
    try {
      rmdirSync(dir);
    } catch {
      // hash dir not empty — other sessions' drafts live here
      return;
    }
    try {
      rmdirSync(join(this.deps.dataDir, "drafts"));
    } catch {
      // other files' hash dirs remain
    }
  }

  async undo(sessionID: string, file: string): Promise<void> {
    const draft = this.findDraft(file, sessionID);
    if (!draft) return;
    this.removeDraft(draft.file, draft.meta.filePathHash);
    this.locks.release(draft.meta.filePathHash, sessionID);
  }

  /** Session ended without accept/discard: mark orphaned, release the lock. */
  async markOrphaned(sessionID: string, file: string): Promise<void> {
    const draft = this.findDraft(file, sessionID);
    if (!draft) return;
    this.writeMeta({ ...draft.meta, status: "orphaned" }, draft.file);
    this.locks.release(draft.meta.filePathHash, sessionID);
  }

  /** Orphan every draft the session still holds (daemon session-end hook). */
  async orphanAll(sessionID: string): Promise<void> {
    const draftsDir = join(this.deps.dataDir, "drafts");
    if (!existsSync(draftsDir)) return;
    for (const hash of readdirSync(draftsDir)) {
      const hashDir = join(draftsDir, hash);
      for (const entry of readdirSync(hashDir)) {
        if (entry.endsWith(".meta.json")) continue;
        const meta = this.readMeta(join(hashDir, entry));
        if (meta && meta.sessionID === sessionID) {
          await this.markOrphaned(sessionID, meta.realFilePath);
        }
      }
    }
  }

  /** Revert path: plant a new active draft from snapshot bytes. */
  async createDraftFromBytes(
    sessionID: string,
    file: string,
    bytes: Uint8Array,
    extension: string
  ): Promise<AcceptResult> {
    const hash = filePathHash(file);
    const acquired = this.locks.acquire(hash, sessionID);
    if (!acquired.ok) return { ok: false, error: LOCKED_ERROR };
    const draftFile = this.draftFile(hash, sessionID, extension);
    mkdirSync(dirname(draftFile), { recursive: true });
    writeFileSync(draftFile, bytes);
    this.writeMeta(
      {
        sessionID,
        realFilePath: file,
        filePathHash: hash,
        extension,
        createdAt: this.now(),
        status: "active",
      },
      draftFile
    );
    return { ok: true };
  }

  /** Drafts under the file's hash dir not owned by this session. */
  orphansFor(file: string, sessionID: string): DraftRef[] {
    const hash = filePathHash(file);
    const dir = this.draftDir(hash);
    if (!existsSync(dir)) return [];
    const refs: DraftRef[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".meta.json")) continue;
      const meta = this.readMeta(join(dir, entry));
      if (meta && meta.sessionID !== sessionID) {
        refs.push({ file: join(dir, entry), meta });
      }
    }
    return refs.sort((a, b) => b.meta.createdAt - a.meta.createdAt);
  }

  private holdsFreshLock(hash: string, sessionID: string): boolean {
    const lock = this.locks.get(hash);
    if (!lock || lock.sessionID !== sessionID) return false;
    return this.now() - lock.lastTouchedAt <= this.staleAfterMs;
  }

  private orphanDraftOf(hash: string, sessionID: string): void {
    const dir = this.draftDir(hash);
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".meta.json")) continue;
      const meta = this.readMeta(join(dir, entry));
      if (meta && meta.sessionID === sessionID) {
        this.writeMeta({ ...meta, status: "orphaned" }, join(dir, entry));
      }
    }
  }

  private findDraft(file: string, sessionID: string): DraftRef | null {
    const hash = filePathHash(file);
    const dir = this.draftDir(hash);
    if (!existsSync(dir)) return null;
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".meta.json")) continue;
      const meta = this.readMeta(join(dir, entry));
      if (meta && meta.sessionID === sessionID) {
        return { file: join(dir, entry), meta };
      }
    }
    return null;
  }

  private async handleOrphans(file: string, sessionID: string): Promise<void> {
    if (!this.deps.askUser) return;
    // Only drafts whose session no longer holds a fresh lock are recoverable;
    // a live session editing the file is the lock's job to block, not a prompt.
    const orphans = this.orphansFor(file, sessionID).filter(
      (d) => !this.holdsFreshLock(d.meta.filePathHash, d.meta.sessionID)
    );
    for (const orphan of orphans) {
      const answer = await this.deps.askUser(
        `You had unreviewed edits from another session — accept or discard? ` +
          `(session ${orphan.meta.sessionID}, created ${new Date(orphan.meta.createdAt).toISOString()})`,
        sessionID
      );
      if (/accept/i.test(answer)) {
        const result = await this.acceptDraft(orphan);
        if (result.ok) break;
        // blocked by an active lock: leave everything for the lock holder
        break;
      }
      if (/discard/i.test(answer)) {
        this.removeDraft(orphan.file, orphan.meta.filePathHash);
        this.locks.release(orphan.meta.filePathHash, orphan.meta.sessionID);
        continue;
      }
      break;
    }
  }

  private async acceptDraft(draft: DraftRef): Promise<AcceptResult> {
    const lock = this.locks.get(draft.meta.filePathHash);
    if (lock && lock.sessionID !== draft.meta.sessionID) {
      return { ok: false, error: LOCKED_ERROR };
    }
    if (!(await this.flush(draft.file))) {
      return { ok: false, error: "Failed to flush the draft before accept" };
    }
    const real = draft.meta.realFilePath;
    mkdirSync(dirname(real), { recursive: true });
    // A resident officecli process may hold the real path open with stale
    // in-memory state from before this accept. Close it BEFORE copying — a
    // resident saves its state on close, so closing after would clobber the
    // freshly accepted file. Closing a path with no resident is a no-op.
    try {
      await this.deps.execOfficeCli(["close", real]);
    } catch {
      // no resident for the path — nothing to close
    }
    copyFileSync(draft.file, real);
    await this.deps.history.record(
      draft.meta.filePathHash,
      draft.meta.sessionID,
      readFileSync(draft.file),
      draft.meta.extension
    );
    this.removeDraft(draft.file, draft.meta.filePathHash);
    this.locks.release(draft.meta.filePathHash, draft.meta.sessionID);
    return { ok: true };
  }
}
