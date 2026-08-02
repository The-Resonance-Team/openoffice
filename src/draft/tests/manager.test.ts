import { describe, expect, test, beforeEach } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DraftManager, filePathHash } from "../manager";
import { HistoryStore } from "../../history";

let dir!: string;
let now: number;
let closes: string[];
let asked: string[];
let answer: string;

function makeManager(opts?: { answer?: string; askUser?: boolean }) {
  closes = [];
  asked = [];
  answer = opts?.answer ?? "discard";
  const askUser =
    opts?.askUser === false
      ? undefined
      : async (q: string) => {
          asked.push(q);
          return answer;
        };
  return new DraftManager({
    dataDir: dir,
    now: () => now,
    staleAfterMs: 24 * 60 * 60 * 1000,
    history: new HistoryStore(dir),
    askUser,
    execOfficeCli: async (args: string[]) => {
      if (args[0] === "close") closes.push(args[1]);
      return { stdout: "", exitCode: 0 };
    },
  });
}

let REAL = "";
const SESS_A = "sess-a";
const SESS_B = "sess-b";
let REAL_PATH = "";
let HASH = "";

function writeReal(content: string) {
  mkdirSync(dirname(REAL_PATH), { recursive: true });
  writeFileSync(REAL_PATH, content);
}

function draftPath(sessionID: string) {
  return join(dir, "drafts", HASH, `${sessionID}.docx`);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-draft-"));
  REAL_PATH = join(dir, "docs", "report.docx");
  REAL = REAL_PATH;
  HASH = filePathHash(REAL);
  now = 1_000_000;
  writeReal("original");
});

describe("DraftManager", () => {
  test("first mutating call creates a draft copy, meta, and lock; real untouched", async () => {
    const mgr = makeManager();
    const result = await mgr.resolve(REAL, SESS_A, true);

    expect(result).toEqual({ path: draftPath(SESS_A) });
    expect(readFileSync(draftPath(SESS_A), "utf-8")).toBe("original");
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("original");
    expect(existsSync(join(dir, "locks", `${filePathHash(REAL)}.json`))).toBe(
      true
    );
    const meta = JSON.parse(
      readFileSync(`${draftPath(SESS_A)}.meta.json`, "utf-8")
    );
    expect(meta.sessionID).toBe(SESS_A);
    expect(meta.status).toBe("active");
  });

  test("mutating redirect: subsequent calls return the draft path", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    const result = await mgr.resolve(REAL, SESS_A, true);
    expect(result.path).toBe(draftPath(SESS_A));
  });

  test("read verbs return the draft once one exists, else the real path", async () => {
    const mgr = makeManager();
    expect((await mgr.resolve(REAL, SESS_A, false)).path).toBe(REAL);
    await mgr.resolve(REAL, SESS_A, true);
    expect((await mgr.resolve(REAL, SESS_A, false)).path).toBe(
      draftPath(SESS_A)
    );
  });

  test("open and create verbs create the draft like mutating verbs", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    expect(existsSync(draftPath(SESS_A))).toBe(true);
    const NEW_FILE = join(dir, "other.docx");
    const result = await mgr.resolve(NEW_FILE, SESS_A, true);
    expect(result.path).not.toBe(NEW_FILE);
    expect(
      existsSync(join(dir, "drafts", filePathHash(NEW_FILE), "sess-a.docx"))
    ).toBe(true);
  });

  test("second session on the same file is locked out with an error", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    const result = await mgr.resolve(REAL, SESS_B, true);
    expect(result).toEqual({
      lockError: "File is being edited in another session",
    });
  });

  test("stale-lock override: B takes over, A's next mutation errors, A's draft marked orphaned", async () => {
    const mgr = makeManager({ askUser: false });
    await mgr.resolve(REAL, SESS_A, true);
    now += 25 * 60 * 60 * 1000;
    expect((await mgr.resolve(REAL, SESS_B, true)).path).toBe(
      draftPath(SESS_B)
    );
    const aMeta = JSON.parse(
      readFileSync(`${draftPath(SESS_A)}.meta.json`, "utf-8")
    );
    expect(aMeta.status).toBe("orphaned");
    const aAgain = await mgr.resolve(REAL, SESS_A, true);
    expect(aAgain.lockError).toBe("File is being edited in another session");
  });

  test("accept fails when the flush fails; real file untouched", async () => {
    let failFlush = true;
    const mgr = new DraftManager({
      dataDir: dir,
      now: () => now,
      staleAfterMs: 24 * 60 * 60 * 1000,
      history: new HistoryStore(dir),
      execOfficeCli: async (args) => {
        if (args[0] === "close" && failFlush) {
          return { stdout: "resident locked", exitCode: 1 };
        }
        return { stdout: "", exitCode: 0 };
      },
    });
    await mgr.resolve(REAL, SESS_A, true);
    writeFileSync(draftPath(SESS_A), "edited");

    const result = await mgr.accept(SESS_A, REAL);
    expect(result.ok).toBe(false);
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("original");
    expect(existsSync(draftPath(SESS_A))).toBe(true);
  });

  test("accept flushes, copies draft to real, records history, cleans up", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    writeFileSync(draftPath(SESS_A), "edited");

    const result = await mgr.accept(SESS_A, REAL);
    expect(result.ok).toBe(true);
    expect(closes).toEqual([draftPath(SESS_A)]);
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("edited");
    expect(mgr.history.list(`${filePathHash(REAL)}`)).toHaveLength(1);
    expect(existsSync(draftPath(SESS_A))).toBe(false);
    expect(existsSync(`${draftPath(SESS_A)}.meta.json`)).toBe(false);
    expect(existsSync(join(dir, "locks", "report.docx-hash.json"))).toBe(false);
  });

  test("undo deletes the draft; real file untouched", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    writeFileSync(draftPath(SESS_A), "edited");

    await mgr.undo(SESS_A, REAL);
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("original");
    expect(existsSync(draftPath(SESS_A))).toBe(false);
    expect(existsSync(`${draftPath(SESS_A)}.meta.json`)).toBe(false);
    expect(mgr.history.list(`${filePathHash(REAL)}`)).toHaveLength(0);
  });

  test("new-file draft: create on a non-existent path, accept creates the real file", async () => {
    const mgr = makeManager();
    const NEW_FILE = join(dir, "new", "deck.pptx");
    const result = await mgr.resolve(NEW_FILE, SESS_A, true);
    expect(result.path).not.toBe(NEW_FILE);
    writeFileSync(result.path!, "deck bytes");

    const accepted = await mgr.accept(SESS_A, NEW_FILE);
    expect(accepted.ok).toBe(true);
    expect(readFileSync(NEW_FILE, "utf-8")).toBe("deck bytes");
  });

  test("orphan scan: an ended session's draft is discoverable and promptable", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    writeFileSync(draftPath(SESS_A), "unreviewed edits");
    await mgr.markOrphaned(SESS_A, REAL);

    const mgrB = makeManager({ answer: "discard" });
    const result = await mgrB.resolve(REAL, SESS_B, true);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("unreviewed edits");
    expect(result.path).toBe(draftPath(SESS_B));
    expect(existsSync(draftPath(SESS_A))).toBe(false);
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("original");
  });

  test("orphan accept writes the orphan's edits to the real file", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    writeFileSync(draftPath(SESS_A), "orphan edits");
    await mgr.markOrphaned(SESS_A, REAL);

    const mgrB = makeManager({ answer: "accept" });
    await mgrB.resolve(REAL, SESS_B, true);
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("orphan edits");
    expect(mgrB.history.list(`${filePathHash(REAL)}`)).toHaveLength(1);
  });

  test("orphan accept is blocked while another session holds an active lock", async () => {
    const mgr = makeManager();
    await mgr.resolve(REAL, SESS_A, true);
    writeFileSync(draftPath(SESS_A), "orphan edits");
    await mgr.markOrphaned(SESS_A, REAL);

    // B acquires the file but declines to resolve A's orphan right now
    const mgrB = makeManager({ answer: "skip" });
    now += 60_000;
    await mgrB.resolve(REAL, SESS_B, true);

    const mgrC = makeManager({ answer: "accept" });
    await mgrC.resolve(REAL, "sess-c", true);
    expect(readFileSync(REAL_PATH, "utf-8")).toBe("original");
    expect(existsSync(draftPath(SESS_A))).toBe(true);
  });

  test("revert path: createDraftFromBytes makes an active draft the session owns", async () => {
    const mgr = makeManager();
    await mgr.createDraftFromBytes(
      SESS_A,
      REAL,
      new TextEncoder().encode("snapshot bytes"),
      ".docx"
    );
    const result = await mgr.resolve(REAL, SESS_A, true);
    expect(result.path).toBe(draftPath(SESS_A));
    expect(readFileSync(draftPath(SESS_A), "utf-8")).toBe("snapshot bytes");
    const meta = JSON.parse(
      readFileSync(`${draftPath(SESS_A)}.meta.json`, "utf-8")
    );
    expect(meta.status).toBe("active");
  });
});
