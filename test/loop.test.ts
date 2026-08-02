import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { SessionStore, runTurn, type Session } from "../src/session";
import type { Config } from "../src/config";
import type { ChatOptions } from "../src/llm";

let dir: string;
let store: SessionStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-loop-"));
  store = new SessionStore(join(dir, "test.db"));
});

function makeSession(): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: "build",
    model: "anthropic/claude-sonnet-4-20250514",
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

function fakeChat(returnedMessages: any[]) {
  return (_options: ChatOptions, _config: Config) => ({
    textStream: (async function* () {
      yield "Hello";
      yield " world";
    })(),
    responseMessages: Promise.resolve(returnedMessages),
  });
}

describe("runTurn", () => {
  test("persists user message and assistant response", async () => {
    const session = makeSession();
    store.save(session);

    await runTurn({
      session,
      userMessage: "Hi",
      store,
      config,
      chatFn: fakeChat([{ role: "assistant", content: "Hello world" }]),
    });

    const loaded = store.load(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.messages[0].role).toBe("user");
    expect(loaded!.messages[0].content).toBe("Hi");
    expect(loaded!.messages[1].role).toBe("assistant");
    expect(loaded!.messages[1].content).toBe("Hello world");
    expect(session.messages).toHaveLength(2);
  });

  test("persists tool call and tool result messages", async () => {
    const session = makeSession();
    store.save(session);

    await runTurn({
      session,
      userMessage: "Run echo",
      store,
      config,
      chatFn: fakeChat([
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "tc1",
              toolName: "echo",
              input: { message: "hi" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "tc1",
              toolName: "echo",
              output: { success: true, output: "hi" },
            },
          ],
        },
        { role: "assistant", content: "Done" },
      ]),
    });

    const loaded = store.load(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(4);
    expect(loaded!.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });

  test("returns streamed text", async () => {
    const session = makeSession();
    store.save(session);

    const result = await runTurn({
      session,
      userMessage: "Hi",
      store,
      config,
      chatFn: fakeChat([{ role: "assistant", content: "Hello world" }]),
    });

    expect(result.text).toBe("Hello world");
  });
});
