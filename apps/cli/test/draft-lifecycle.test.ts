import { describe, expect, test, beforeEach } from "bun:test";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createOfficeCliTool } from "@openoffice/core";
import { DraftManager, filePathHash } from "@openoffice/core";
import { HistoryStore } from "@openoffice/core";
import { createReadTool } from "@openoffice/core";

let dir: string;
let realFile: string;
let asked: string[];
let answer: string;

interface Harness {
  tool: ReturnType<typeof createOfficeCliTool>;
  draftManager: DraftManager;
  history: HistoryStore;
  readTool: ReturnType<typeof createReadTool>;
}

function makeHarness(opts?: { answer?: string }): Harness {
  asked = [];
  answer = opts?.answer ?? "discard";
  const history = new HistoryStore(dir);
  const draftManager = new DraftManager({
    dataDir: dir,
    history,
    askUser: async (q) => {
      asked.push(q);
      return answer;
    },
    execOfficeCli: async () => ({ stdout: "", exitCode: 0 }),
  });
  const execCli = async (args: string[]) => {
    const [cmd, file] = args;
    if (cmd === "set" || cmd === "add" || cmd === "remove") {
      writeFileSync(file, "edited-by-agent");
      return JSON.stringify({ success: true });
    }
    if (cmd === "get") {
      return JSON.stringify({
        success: true,
        data: { content: readFileSync(file, "utf-8") },
      });
    }
    return JSON.stringify({ success: true });
  };
  const tool = createOfficeCliTool({
    checkInstalled: async () => true,
    execCli,
    draftManager,
  });
  const readTool = createReadTool({
    draftManager,
    readDocument: async (file) =>
      JSON.parse(await execCli(["get", file])).data.content,
  });
  return { tool, draftManager, history, readTool };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-lifecycle-"));
  realFile = join(dir, "report.docx");
  mkdirSync(dirname(realFile), { recursive: true });
  writeFileSync(realFile, "original");
});

describe("draft lifecycle end-to-end", () => {
  test("edit → accept: real file updated, history recorded, cleanup complete", async () => {
    const { tool, draftManager, history } = makeHarness();

    const set = await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-a" }
    );
    expect(set.success).toBe(true);
    expect(readFileSync(realFile, "utf-8")).toBe("original");

    const accepted = await draftManager.accept("sess-a", realFile);
    expect(accepted.ok).toBe(true);
    expect(readFileSync(realFile, "utf-8")).toBe("edited-by-agent");
    expect(history.list(filePathHash(realFile))).toHaveLength(1);
    expect(existsSync(join(dir, "drafts"))).toBe(false);
    expect(existsSync(join(dir, "locks"))).toBe(false);
  });

  test("edit → undo: real file untouched, nothing recorded", async () => {
    const { tool, draftManager, history } = makeHarness();

    await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-a" }
    );
    await draftManager.undo("sess-a", realFile);

    expect(readFileSync(realFile, "utf-8")).toBe("original");
    expect(history.list(filePathHash(realFile))).toHaveLength(0);
    expect(existsSync(join(dir, "drafts"))).toBe(false);
  });

  test("revert replants a snapshot as a draft; accept writes it", async () => {
    const { tool, draftManager, history } = makeHarness();

    const point = await history.record(
      filePathHash(realFile),
      "old-session",
      new TextEncoder().encode("old state"),
      ".docx"
    );
    const reverted = await draftManager.createDraftFromBytes(
      "sess-a",
      realFile,
      history.restore(filePathHash(realFile), point.timestamp)!,
      ".docx"
    );
    expect(reverted.ok).toBe(true);
    expect(readFileSync(realFile, "utf-8")).toBe("original");

    const get = await tool.execute(
      { command: "get", file: realFile },
      { sessionID: "sess-a" }
    );
    expect(get.success).toBe(true);

    await draftManager.accept("sess-a", realFile);
    expect(readFileSync(realFile, "utf-8")).toBe("old state");
    expect(history.list(filePathHash(realFile))).toHaveLength(2);
  });

  test("cross-session orphan recovery: accept via prompt writes the orphan's edits", async () => {
    const a = makeHarness();
    await a.tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-a" }
    );
    await a.draftManager.markOrphaned("sess-a", realFile);

    const b = makeHarness({ answer: "accept" });
    const get = await b.tool.execute(
      { command: "get", file: realFile },
      { sessionID: "sess-b" }
    );
    expect(get.success).toBe(true);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("unreviewed edits");
    expect(readFileSync(realFile, "utf-8")).toBe("edited-by-agent");
    expect(b.history.list(filePathHash(realFile))).toHaveLength(1);
  });

  test("read tool sees draft content once a draft exists", async () => {
    const { tool, readTool } = makeHarness();

    await tool.execute(
      { command: "set", file: realFile, path: "/p", props: { x: "1" } },
      { sessionID: "sess-a" }
    );
    const result = await readTool.execute(
      { file: realFile },
      { sessionID: "sess-a" }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("edited-by-agent");
    }
  });

  test("read tool reads a new-file draft before the real file exists", async () => {
    const { tool, readTool } = makeHarness();
    const NEW = join(dir, "new", "deck.pptx");
    await tool.execute(
      { command: "create", file: NEW },
      { sessionID: "sess-a" }
    );
    const result = await readTool.execute(
      { file: NEW },
      { sessionID: "sess-a" }
    );
    expect(result.success).toBe(true);
    if (!result.success) {
      expect(result.error).not.toContain("File not found");
    }
  });
});
