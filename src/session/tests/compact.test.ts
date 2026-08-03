import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { SessionStore, type Session } from "../index";
import { compactHistory, tailCutoff, DEFAULT_TAIL_TURNS } from "../compact";
import { on } from "../../events";
import type { Config } from "../../config";

function turn(turn: number, userText = `user ${turn}`): ModelMessage[] {
  return [
    { role: "user", content: userText },
    { role: "assistant", content: `reply ${turn}` },
  ];
}

function messages(nTurns: number): ModelMessage[] {
  return Array.from({ length: nTurns }, (_, i) => turn(i + 1)).flat();
}

describe("tailCutoff", () => {
  test("returns the index of the first message beyond the last N turns", () => {
    expect(tailCutoff(messages(5), 2)).toBe(6);
  });

  test("returns 0 when there are fewer turns than the tail", () => {
    expect(tailCutoff(messages(1), 2)).toBe(0);
  });

  test("a zero tail summarizes everything", () => {
    expect(tailCutoff(messages(5), 0)).toBe(0);
  });

  test("a system summary message does not count as a turn", () => {
    const msgs = [
      { role: "system", content: "summary" } as ModelMessage,
      ...messages(3),
    ];
    // tail = last 2 user turns (u2 at index 3, u3 at index 5)
    expect(tailCutoff(msgs, 2)).toBe(3);
  });

  test("default tail turns is 2", () => {
    expect(DEFAULT_TAIL_TURNS).toBe(2);
  });
});

describe("compactHistory", () => {
  let dir: string;
  let store: SessionStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oo-compact-"));
    store = new SessionStore(join(dir, "test.db"));
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

  const fakeSummarize = async (
    head: ModelMessage[],
    _model: string,
    _config: Config
  ) => `SUMMARY(${head.length} msgs)`;

  test("replaces everything before the tail with one system message", async () => {
    const msgs = messages(5);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    const changed = await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: fakeSummarize,
    });
    expect(changed).toBe(true);

    expect(session.messages).toHaveLength(5);
    expect(session.messages[0]).toEqual({
      role: "system",
      content: "SUMMARY(6 msgs)",
    });
    // tail preserved verbatim
    expect(session.messages.slice(1)).toEqual(messages(5).slice(6));

    const loaded = store.load(session.id)!;
    expect(loaded.messages).toEqual(session.messages);
  });

  test("no-op when there is nothing beyond the tail", async () => {
    const msgs = messages(2);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    let summarized = 0;
    const changed = await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: async () => {
        summarized++;
        return "SUMMARY";
      },
    });
    expect(changed).toBe(false);
    expect(summarized).toBe(0);
    expect(session.messages).toHaveLength(4);
  });

  test("respects the configured tail turns", async () => {
    const msgs = messages(4);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    await compactHistory({
      session,
      store,
      config: { compaction: { tailTurns: 1 } },
      summarizeFn: fakeSummarize,
    });

    expect(session.messages).toHaveLength(3);
    expect(session.messages[0].content).toBe("SUMMARY(6 msgs)");
    expect(session.messages.slice(1)).toEqual(messages(4).slice(6));
  });

  test("a second compaction summarizes only the new head", async () => {
    const msgs = messages(5);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: fakeSummarize,
    });
    const first = session.messages;

    await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: fakeSummarize,
    });

    // head = the previous summary alone (1 msg), summarized again
    expect(session.messages).toHaveLength(5);
    expect(session.messages[0].content).toBe("SUMMARY(1 msgs)");
    expect(session.messages.slice(1)).toEqual(first.slice(1));
  });

  test("emits session:compacted", async () => {
    const msgs = messages(5);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    const events: string[] = [];
    const off = on("session:compacted", (data) => events.push(data.sessionID));
    await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: fakeSummarize,
    });
    off();

    expect(events).toEqual([session.id]);
  });
});
