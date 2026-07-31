import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore } from "../src/session/store";
import type { Session } from "../src/session/types";

let dir: string;
let store: SessionStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-test-"));
  store = new SessionStore(join(dir, "test.db"));
});

function makeSession(id = "s1"): Session {
  return {
    id,
    agent: "build",
    model: "anthropic/claude-sonnet-4-20250514",
    title: "Test session",
    messages: [],
    createdAt: 1000,
    updatedAt: 1000,
  };
}

describe("SessionStore", () => {
  test("save and load", () => {
    const s = makeSession();
    store.save(s);
    const loaded = store.load("s1");
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("s1");
    expect(loaded!.agent).toBe("build");
  });

  test("load returns null for missing", () => {
    expect(store.load("nope")).toBeNull();
  });

  test("list returns all sessions", () => {
    store.save(makeSession("s1"));
    store.save(makeSession("s2"));
    const list = store.list();
    expect(list).toHaveLength(2);
  });

  test("delete removes session", () => {
    store.save(makeSession("s1"));
    store.delete("s1");
    expect(store.load("s1")).toBeNull();
  });

  test("appendMessage stores and loads messages", () => {
    store.save(makeSession("s1"));
    store.appendMessage("s1", "m1", { role: "user", content: "hello" }, 2000);
    const loaded = store.load("s1");
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0]).toEqual({ role: "user", content: "hello" });
  });

  test("appendMessage handles structured content", () => {
    store.save(makeSession("s1"));
    const parts: any[] = [
      { type: "text", text: "hi" },
      { type: "tool-call", toolCallId: "1", toolName: "echo", input: {} },
    ];
    store.appendMessage(
      "s1",
      "m1",
      { role: "assistant", content: parts },
      2000
    );
    const loaded = store.load("s1");
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].role).toBe("assistant");
  });
});
