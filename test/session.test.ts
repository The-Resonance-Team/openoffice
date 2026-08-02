import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore, type Session } from "../src/session";

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
    store.appendMessage(
      "s1",
      "m1",
      { role: "user", content: "hello" },
      2000,
      1
    );
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
      2000,
      1
    );
    const loaded = store.load("s1");
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].role).toBe("assistant");
  });

  test("timestamps round-trip through Date conversion", () => {
    const s = makeSession("s1");
    s.createdAt = 1700000000000;
    s.updatedAt = 1700000001000;
    store.save(s);
    const loaded = store.load("s1");
    expect(loaded!.createdAt).toBe(1700000000000);
    expect(loaded!.updatedAt).toBe(1700000001000);
  });

  test("save-on-conflict preserves createdAt, bumps updatedAt", () => {
    const s = makeSession("s1");
    s.createdAt = 1000;
    s.updatedAt = 1000;
    store.save(s);

    s.updatedAt = 2000;
    s.title = "Updated";
    store.save(s);

    const loaded = store.load("s1");
    expect(loaded!.createdAt).toBe(1000);
    expect(loaded!.updatedAt).toBe(2000);
    expect(loaded!.title).toBe("Updated");
  });

  test("list orders by updatedAt descending", () => {
    const s1 = makeSession("s1");
    s1.updatedAt = 1000;
    store.save(s1);

    const s2 = makeSession("s2");
    s2.updatedAt = 3000;
    store.save(s2);

    const s3 = makeSession("s3");
    s3.updatedAt = 2000;
    store.save(s3);

    const list = store.list();
    expect(list.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
  });

  test("nextSeq increments per session", () => {
    store.save(makeSession("s1"));
    store.save(makeSession("s2"));

    expect(store.nextSeq("s1")).toBe(1);
    store.appendMessage("s1", "m1", { role: "user", content: "a" }, 1000, 1);
    expect(store.nextSeq("s1")).toBe(2);
    store.appendMessage(
      "s1",
      "m2",
      { role: "assistant", content: "b" },
      1001,
      2
    );
    expect(store.nextSeq("s1")).toBe(3);

    // s2 is independent
    expect(store.nextSeq("s2")).toBe(1);
  });
});
