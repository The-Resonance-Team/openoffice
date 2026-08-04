import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import {
  SessionStore,
  type Session,
  generateHandoff,
  redactHandoff,
} from "../index";
import { createHandoffTool } from "../../tool";
import type { Config } from "../../config";

const KEY = "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

describe("redactHandoff", () => {
  test("redacts API keys, bearer tokens, AWS keys, and private keys", () => {
    const text = `key: ${KEY}, token: Bearer abc123def456ghi789jkl012,
aws AKIAIOSFODNN7EXAMPLE, password=supersecret,
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC
-----END PRIVATE KEY-----`;
    const out = redactHandoff(text);
    expect(out).not.toContain(KEY);
    expect(out).not.toContain("supersecret");
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(out).not.toContain("MIIEvQIBADANBgkqhkiG9w0BAQEFAASC");
    expect(out).not.toContain("Bearer abc123");
    expect(out).toContain("[REDACTED]");
  });

  test("leaves ordinary text untouched", () => {
    const text = "The session reviewed the hospital supply contract.";
    expect(redactHandoff(text)).toBe(text);
  });
});

describe("generateHandoff", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oo-handoff-"));
  });

  const makeSession = (msgs: ModelMessage[]): Session => ({
    id: randomUUID(),
    agent: "build",
    model: "anthropic/claude-sonnet-4-6",
    title: "T",
    cwd: process.cwd(),
    messages: msgs,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const config: Config = {};

  test("writes the summarized conversation to the temp dir and returns its path", async () => {
    const session = makeSession([
      { role: "user", content: "Draft the contract" },
      { role: "assistant", content: "Done" },
    ]);

    const { path } = await generateHandoff({
      session,
      config,
      dir,
      summarizeFn: async () => "# Handoff\n\nDrafted the contract.",
    });

    expect(existsSync(path)).toBe(true);
    expect(path.startsWith(dir)).toBe(true);
    expect(path.endsWith(".md")).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("# Handoff");
    expect(readFileSync(path, "utf8")).toContain("Drafted the contract.");
  });

  test("redacts secrets from the generated document", async () => {
    const session = makeSession([{ role: "user", content: "hi" }]);

    const { path } = await generateHandoff({
      session,
      config,
      dir,
      summarizeFn: async () => `Connected with api key ${KEY}.`,
    });

    const content = readFileSync(path, "utf8");
    expect(content).not.toContain(KEY);
    expect(content).toContain("[REDACTED]");
  });

  test("a focus hint is passed through to the summarizer", async () => {
    const session = makeSession([{ role: "user", content: "hi" }]);

    let seenFocus = "";
    await generateHandoff({
      session,
      config,
      dir,
      focus: "signing the contract",
      summarizeFn: async (messages, _model, _config, focus) => {
        seenFocus = focus ?? "";
        return "ok";
      },
    });

    expect(seenFocus).toContain("signing the contract");
  });
});

describe("createHandoffTool", () => {
  let dir: string;
  let store: SessionStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oo-handoff-tool-"));
    store = new SessionStore(join(dir, "test.db"));
  });

  test("writes a handoff for the session in context", async () => {
    const session = makeSession();
    store.save(session);
    store.replaceMessages(session.id, [
      { role: "user", content: "Draft the contract" },
      { role: "assistant", content: "Done" },
    ]);

    const tool = createHandoffTool({
      store,
      config: {},
      summarizeFn: async () => "# Handoff\n\nDrafted the contract.",
    });
    const result = await tool.execute(
      {},
      { sessionID: session.id, cwd: process.cwd() }
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toContain("handoff");
  });

  test("fails cleanly when the session does not exist", async () => {
    const tool = createHandoffTool({ store, config: {} });
    const result = await tool.execute(
      {},
      { sessionID: "missing", cwd: process.cwd() }
    );
    expect(result.success).toBe(false);
  });
});

function makeSession(): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: "build",
    model: "anthropic/claude-sonnet-4-6",
    title: "T",
    cwd: process.cwd(),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
