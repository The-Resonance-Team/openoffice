import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { SessionStore, type Session } from "../index";
import {
  compactHistory,
  tailCutoff,
  preserveRecentTokens,
  truncateToolOutputs,
  DEFAULT_TAIL_TURNS,
} from "../compact";
import { estimateTokens } from "../prune";
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

  test("an unbounded budget behaves like the fixed tail", () => {
    expect(tailCutoff(messages(5), 2, Number.POSITIVE_INFINITY)).toBe(6);
  });

  test("drops turns that do not fit the token budget", () => {
    const msgs = messages(5); // each turn: "user N" + "reply N", ~30 chars each
    const perTurn = estimateTokens(JSON.stringify(turn(1)));
    const budget = perTurn + 1; // newest turn fits, the next one does not
    expect(tailCutoff(msgs, 2, budget)).toBe(6);
    expect(tailCutoff(msgs, 2, perTurn - 1)).toBe(8);
  });

  test("a zero tail summarizes everything regardless of budget", () => {
    expect(tailCutoff(messages(5), 0, 1_000_000)).toBe(0);
  });
});

describe("preserveRecentTokens", () => {
  test("is a quarter of the usable window, clamped to 2k-8k", () => {
    expect(preserveRecentTokens(undefined, 980_000)).toBe(8_000);
    expect(preserveRecentTokens(undefined, 20_000)).toBe(5_000);
    expect(preserveRecentTokens(undefined, 4_000)).toBe(2_000);
  });

  test("config override wins", () => {
    expect(preserveRecentTokens({ preserveRecentTokens: 1_000 }, 980_000)).toBe(
      1_000
    );
  });
});

describe("truncateToolOutputs", () => {
  const toolMsg = (n: number): ModelMessage[] => [
    {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "officecli",
          input: {},
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "c1",
          toolName: "officecli",
          output: { type: "text", value: "x".repeat(n) },
        },
      ],
    },
  ];

  test("truncates long tool outputs with a marker, keeps short ones", () => {
    const msgs = [...turn(1), ...toolMsg(5_000), ...toolMsg(10)];
    const out = truncateToolOutputs(msgs, 2_000);
    const parts = out[3].content as any[];
    expect((parts[0].output.value as string).length).toBe(2_000 + 14);
    expect((parts[0].output.value as string).endsWith("… [truncated]")).toBe(
      true
    );
    expect((out[5].content as any[])[0].output.value).toBe("x".repeat(10));
  });

  test("does not mutate the original history", () => {
    const msgs = [...toolMsg(5_000)];
    truncateToolOutputs(msgs, 2_000);
    expect((msgs[1].content as any[])[0].output.value).toBe("x".repeat(5_000));
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

  const offlineFetch = () =>
    Promise.reject(new Error("offline (test)")).then(() => new Response());

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
      fetchFn: offlineFetch,
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
      fetchFn: offlineFetch,
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
      fetchFn: offlineFetch,
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
      fetchFn: offlineFetch,
    });
    const first = session.messages;

    await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: fakeSummarize,
      fetchFn: offlineFetch,
    });

    // head = the previous summary alone (1 msg), summarized again
    expect(session.messages).toHaveLength(5);
    expect(session.messages[0].content).toBe("SUMMARY(1 msgs)");
    expect(session.messages.slice(1)).toEqual(first.slice(1));
  });

  test("passes the focus hint to the summarizer", async () => {
    const msgs = messages(5);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    let seenFocus = "";
    await compactHistory({
      session,
      store,
      config: {},
      focus: "sign the contract",
      summarizeFn: async (_head, _model, _cfg, focus) => {
        seenFocus = focus ?? "";
        return "SUMMARY";
      },
      fetchFn: offlineFetch,
    });

    expect(seenFocus).toContain("sign the contract");
  });

  test("redacts secrets from the summary message", async () => {
    const msgs = messages(5);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: async () =>
        `Connected with api key sk-SECRETKEY0123456789ABCDEFGHIJ.`,
      fetchFn: offlineFetch,
    });

    expect(session.messages[0].content).not.toContain("sk-SECRETKEY");
    expect(session.messages[0].content).toContain("[REDACTED]");
  });

  test("saves the handoff document to the temp dir", async () => {
    const msgs = messages(5);
    const session = makeSession(msgs);
    store.save(session);
    store.replaceMessages(session.id, msgs);

    const dir = mkdtempSync(join(tmpdir(), "oo-compact-doc-"));
    await compactHistory({
      session,
      store,
      config: {},
      summarizeFn: async () => "# Handoff\n\nDrafted the contract.",
      fetchFn: offlineFetch,
      dir,
    });

    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0].endsWith(".md")).toBe(true);
    expect(readFileSync(join(dir, files[0]), "utf8")).toContain("# Handoff");
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
      fetchFn: offlineFetch,
    });
    off();

    expect(events).toEqual([session.id]);
  });
});
