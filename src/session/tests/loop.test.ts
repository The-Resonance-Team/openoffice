import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runTurn } from "../loop";
import { SessionStore } from "../store";
import type { Session } from "../types";
import type { ChatOptions } from "../../llm";

// Regression: with PRAGMA foreign_keys = ON (daemon), a turn whose assistant
// message carries a tool-call part must persist the message row before its
// parts — otherwise parts.message_id -> messages(id) violates the FK and
// every tool-using turn fails. This is the persistence path the route tests
// (fakeRunTurn) never exercise.
describe("runTurn persistence with foreign keys enforced", () => {
  let dbPath: string;
  let store: SessionStore;

  beforeEach(() => {
    dbPath = join(tmpdir(), `loop-${Date.now()}-${Math.random()}.db`);
    store = new SessionStore(dbPath);
  });

  afterEach(() => {
    store.close();
    try {
      rmSync(dbPath, { force: true });
    } catch {
      // see store.test.ts: OS temp dir cleanup is best-effort on Windows
    }
  });

  const makeSession = (id: string): Session => ({
    id,
    agent: "test",
    model: "test/model",
    title: "",
    cwd: "/tmp",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  test("a turn with a tool call persists message and tool part", async () => {
    const session = makeSession("s1");
    store.save(session);

    // chatFn is not awaited — return the result object synchronously.
    const chatFn = (_options: ChatOptions) => ({
      textStream: (async function* () {
        yield "working";
      })(),
      responseMessages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "tc1",
              toolName: "fake_tool",
              input: {},
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "tc1",
              toolName: "fake_tool",
              output: { type: "text", value: "ok" },
            },
          ],
        },
      ],
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const { text } = await runTurn({
      session,
      userMessage: "run it",
      store,
      agents: {},
      config: {},
      chatFn,
    } as any);

    expect(text).toBe("working");
    const messages = store.messages("s1");
    expect(messages.map((m) => m.info.role)).toEqual(["user", "assistant"]);
    const assistant = messages.find((m) => m.info.role === "assistant")!;
    expect(assistant.parts.some((p) => p.type === "tool")).toBe(true);
    expect(assistant.info.finish).toBe("done");
  });
});
