import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runTurn } from "../loop";
import { SessionStore } from "../store";
import { on } from "../../events";
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
      hitStepCap: () => false,
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

  test("hitting the step cap forces a text-only summary pulling from the todo list", async () => {
    const session = makeSession("s1");
    store.save(session);
    store.setTodos("s1", [
      { content: "write the doc", status: "in_progress", priority: "high" },
    ]);

    let calls = 0;
    const summaryOptions: ChatOptions = {} as ChatOptions;
    const chatFn = (options: ChatOptions) => {
      calls++;
      if (calls === 1) {
        return {
          textStream: (async function* () {
            yield "starting";
          })(),
          responseMessages: [{ role: "assistant", content: "starting" }],
          usage: { inputTokens: 1, outputTokens: 1 },
          hitStepCap: () => true,
        };
      }
      Object.assign(summaryOptions, options);
      return {
        textStream: (async function* () {
          yield "SUMMARY";
        })(),
        responseMessages: [{ role: "assistant", content: "SUMMARY" }],
        usage: { inputTokens: 1, outputTokens: 1 },
        hitStepCap: () => false,
      };
    };

    const events: { sessionID: string; maxSteps: number }[] = [];
    const off = on("session:step-limit", (d) => events.push(d));
    let text: string;
    try {
      ({ text } = await runTurn({
        session,
        userMessage: "do it",
        store,
        agents: {},
        config: {},
        chatFn,
        maxSteps: 10,
      } as any));
    } finally {
      off();
    }

    expect(calls).toBe(2);
    // Summary call: tools disabled, capped at one step, prompt appended last.
    expect(summaryOptions.tools).toBeUndefined();
    expect(summaryOptions.maxSteps).toBe(1);
    const last = summaryOptions.messages![summaryOptions.messages!.length - 1];
    expect(last.role).toBe("assistant");
    expect(String(last.content)).toContain("MAXIMUM STEPS REACHED");
    expect(String(last.content)).toContain("write the doc");

    // The summary lands as the final assistant message, marked max-steps.
    expect(text).toContain("SUMMARY");
    const msgs = store.messages("s1");
    const summary = msgs.find(
      (m) =>
        m.info.role === "assistant" &&
        m.info.finish === "max-steps" &&
        m.parts.some((p) => p.type === "text" && p.text === "SUMMARY")
    );
    expect(summary).toBeDefined();
    expect((summary!.parts[0] as { text: string }).text).toBe("SUMMARY");

    expect(events).toEqual([{ sessionID: "s1", maxSteps: 10 }]);
  });

  test("a failing summary call falls back to a local message", async () => {
    const session = makeSession("s1");
    store.save(session);

    let calls = 0;
    const chatFn = (_options: ChatOptions) => {
      calls++;
      if (calls === 1) {
        return {
          textStream: (async function* () {
            yield "starting";
          })(),
          responseMessages: [{ role: "assistant", content: "starting" }],
          usage: { inputTokens: 1, outputTokens: 1 },
          hitStepCap: () => true,
        };
      }
      throw new Error("summary failed");
    };

    const events: unknown[] = [];
    const off = on("session:step-limit", (d) => events.push(d));
    let text: string;
    try {
      ({ text } = await runTurn({
        session,
        userMessage: "do it",
        store,
        agents: {},
        config: {},
        chatFn,
        maxSteps: 10,
      } as any));
    } finally {
      off();
    }

    expect(text).toContain("Reached the step limit");
    const msgs = store.messages("s1");
    const summary = msgs.find(
      (m) =>
        m.info.role === "assistant" &&
        m.info.finish === "max-steps" &&
        m.parts.some(
          (p) => p.type === "text" && p.text.includes("Reached the step limit")
        )
    );
    expect(summary).toBeDefined();
    expect(events).toHaveLength(1);
  });
});
