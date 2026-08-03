import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { SessionStore, runTurn, type Session } from "../index";
import { PRUNE_PLACEHOLDER } from "../prune";
import type { Config } from "../../config";
import type { ChatOptions } from "../../llm";

let dir: string;
let store: SessionStore;
let oldHome: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-loop-"));
  store = new SessionStore(join(dir, "test.db"));
  oldHome = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = dir;
});

afterEach(() => {
  if (oldHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = oldHome;
});

// No network in tests: the catalog comes from the vendored snapshot.
const offlineFetch = () =>
  Promise.reject(new Error("offline (test)")).then(() => new Response());

function makeSession(): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: "build",
    model: "anthropic/claude-sonnet-4-6",
    title: "Test",
    cwd: process.cwd(),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

const config: Config = {
  provider: { anthropic: { apiKey: "test-key" } },
};

function fakeChat(
  returnedMessages: any[],
  usage?: { inputTokens?: number; outputTokens?: number }
) {
  return (_options: ChatOptions, _config: Config) => ({
    textStream: (async function* () {
      yield "Hello";
      yield " world";
    })(),
    responseMessages: Promise.resolve(returnedMessages),
    usage: usage ? Promise.resolve({ ...usage, totalTokens: 1 }) : undefined,
  });
}

async function seedHistory(
  session: Session,
  userTurns: number,
  opts?: {
    toolOutputChars?: number;
    lastUsage?: { inputTokens: number; outputTokens: number };
  }
): Promise<void> {
  const messages: ModelMessage[] = [];
  for (let t = 1; t <= userTurns; t++) {
    messages.push({ role: "user", content: `user ${t}` });
    if (opts?.toolOutputChars) {
      const callId = `call-${t}`;
      messages.push({
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: callId,
            toolName: "officecli",
            input: {},
          },
        ],
      });
      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: callId,
            toolName: "officecli",
            output: { type: "text", value: "x".repeat(opts.toolOutputChars) },
          },
        ],
      });
    }
    messages.push({ role: "assistant", content: `reply ${t}` });
  }
  session.messages = messages;
  store.save(session);
  store.replaceMessages(session.id, messages);
  if (opts?.lastUsage) {
    store.setTokens(session.id, messages.length, opts.lastUsage);
  }
}

describe("runTurn token accounting", () => {
  test("persists usage on the final assistant message", async () => {
    const session = makeSession();
    await seedHistory(session, 1);
    const assistantSeq = session.messages.length;

    await runTurn({
      session,
      userMessage: "next",
      store,
      config,
      chatFn: fakeChat([{ role: "assistant", content: "Hello world" }], {
        inputTokens: 120,
        outputTokens: 30,
      }),
    });

    const usage = store.lastUsage(session.id);
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 30 });
    const loaded = store.load(session.id)!;
    expect(loaded.messages.length).toBe(assistantSeq + 2);
  });

  test("missing usage on the fake is tolerated", async () => {
    const session = makeSession();
    await seedHistory(session, 1);

    const result = await runTurn({
      session,
      userMessage: "next",
      store,
      config,
      chatFn: fakeChat([{ role: "assistant", content: "ok" }]),
    });
    expect(result.text).toBe("Hello world");
  });
});

describe("runTurn compaction trigger", () => {
  test("under the window: history passes through untouched", async () => {
    const session = makeSession();
    await seedHistory(session, 2, {
      lastUsage: { inputTokens: 100, outputTokens: 20 },
    });

    let seen: ModelMessage[] = [];
    await runTurn({
      session,
      userMessage: "next",
      store,
      config,
      chatFn: (options) => {
        seen = [...options.messages];
        return fakeChat([{ role: "assistant", content: "ok" }])(
          options,
          config
        );
      },
      fetchFn: offlineFetch,
    });

    expect(seen).toHaveLength(5);
    expect(seen[0].role).toBe("user");
  });

  test("prunes old tool outputs when over the window, no compact needed", async () => {
    const session = makeSession();
    // 4 turns, each with a 40k-char tool output; last usage claims overflow
    await seedHistory(session, 4, {
      toolOutputChars: 40_000,
      lastUsage: { inputTokens: 1_000_000, outputTokens: 100 },
    });

    let seen: ModelMessage[] = [];
    await runTurn({
      session,
      userMessage: "next",
      store,
      config: {
        compaction: { pruneProtectTokens: 1_000, pruneMinimumTokens: 1_000 },
      },
      chatFn: (options) => {
        seen = [...options.messages];
        return fakeChat([{ role: "assistant", content: "ok" }])(
          options,
          config
        );
      },
      summarizeFn: async () => {
        throw new Error("compact should not run");
      },
      fetchFn: offlineFetch,
    });

    const pruned = seen.filter((m) =>
      Array.isArray(m.content)
        ? (m.content as any[]).some(
            (p) =>
              p.type === "tool-result" && p.output?.value === PRUNE_PLACEHOLDER
          )
        : false
    );
    expect(pruned.length).toBeGreaterThan(0);
  });

  test("compacts when prune is not enough, tail preserved", async () => {
    const session = makeSession();
    // 6 turns of long text; no tool outputs, so prune frees nothing
    await seedHistory(session, 6, {
      lastUsage: { inputTokens: 1_000_000, outputTokens: 100 },
    });
    for (let i = 0; i < session.messages.length; i += 2) {
      session.messages[i] = {
        role: "user",
        content: "x".repeat(25_000) + ` user ${i}`,
      };
    }
    store.replaceMessages(session.id, session.messages);

    const summarized: ModelMessage[][] = [];
    let seen: ModelMessage[] = [];
    const result = await runTurn({
      session,
      userMessage: "next",
      store,
      // shrink the usable window so the post-prune estimate triggers compact
      config: { compaction: { reservedTokens: 999_000 } },
      chatFn: (options) => {
        seen = [...options.messages];
        return fakeChat([{ role: "assistant", content: "ok" }])(
          options,
          config
        );
      },
      summarizeFn: async (head) => {
        summarized.push(head);
        return "SUMMARY";
      },
      fetchFn: offlineFetch,
    });

    expect(result.text).toBe("Hello world");
    expect(summarized).toHaveLength(1);
    expect(summarized[0]).toHaveLength(8); // 4 seeded turns
    // summary replaced the head; last two completed turns kept verbatim,
    // then the fresh user message
    expect(seen[0].role).toBe("system");
    expect(seen[0].content).toBe("SUMMARY");
    expect(seen.filter((m) => m.role === "user")).toHaveLength(3);
    expect(seen[seen.length - 1].content).toBe("next");
    expect(seen[seen.length - 2].content).toBe("reply 6");
  });
});
