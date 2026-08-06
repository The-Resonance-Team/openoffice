import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore } from "../store";
import type { Session } from "../types";

describe("SessionStore", () => {
  let dbPath: string;
  let store: SessionStore;

  beforeEach(() => {
    dbPath = join(tmpdir(), `test-${Date.now()}-${Math.random()}.db`);
    store = new SessionStore(dbPath);
  });

  afterEach(() => {
    store.close();
    // Windows keeps the WAL handle locked briefly after close() even with
    // retries (bun:sqlite). Best-effort cleanup — the OS temp dir is purged
    // by the OS, so a leaked file here is harmless.
    try {
      rmSync(dbPath, { force: true });
    } catch {
      // ignore: see above
    }
  });

  const makeSession = (id: string): Session => ({
    id,
    agent: "test",
    model: "test/model",
    title: "Test",
    cwd: "/tmp",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  test("messages() returns empty array for new session", () => {
    const session = makeSession("s1");
    store.save(session);
    expect(store.messages("s1")).toEqual([]);
  });

  test("messages() groups parts by message", () => {
    const session = makeSession("s1");
    store.save(session);

    const msgId = "m1";
    store.updateMessage("s1", {
      id: msgId,
      role: "user",
      agent: "test",
      model: { providerID: "test", modelID: "model" },
      time: { created: Date.now() },
    });
    store.updatePart("s1", msgId, { type: "text", text: "Hello" });
    store.updatePart("s1", msgId, { type: "text", text: "World" });

    const msgs = store.messages("s1");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].info.id).toBe(msgId);
    expect(msgs[0].parts).toHaveLength(2);
    expect(msgs[0].parts[0].type).toBe("text");
    expect(msgs[0].parts[1].type).toBe("text");
  });

  test("updatePart() upserts by part id", () => {
    const session = makeSession("s1");
    store.save(session);

    const msgId = "m1";
    store.updateMessage("s1", {
      id: msgId,
      role: "user",
      time: { created: Date.now() },
    });

    const partId = store.updatePart("s1", msgId, { type: "text", text: "v1" });
    expect(store.messages("s1")[0].parts[0].type).toBe("text");

    store.updatePart("s1", msgId, { id: partId, type: "text", text: "v2" });
    const msgs = store.messages("s1");
    expect(msgs[0].parts).toHaveLength(1);
    expect((msgs[0].parts[0] as any).text).toBe("v2");
  });

  test("updateMessage() upserts by message id", () => {
    const session = makeSession("s1");
    store.save(session);

    const msgId = "m1";
    store.updateMessage("s1", {
      id: msgId,
      role: "user",
      time: { created: Date.now() },
    });

    store.updateMessage("s1", {
      id: msgId,
      role: "assistant",
      finish: "done",
      time: { created: Date.now() },
    });

    const msgs = store.messages("s1");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].info.role).toBe("assistant");
    expect(msgs[0].info.finish).toBe("done");
  });
});
