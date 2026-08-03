import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { SessionStore, type Session } from "../index";
import {
  estimateTokens,
  selectPruneTargets,
  applyPrune,
  pruneSession,
  PRUNE_PLACEHOLDER,
} from "../prune";
import type { Config } from "../../config";

// turns: user -> assistant(tool-call) -> tool(result); final assistant text
function toolTurn(
  turn: number,
  outputLength: number,
  userText = "u" + turn
): ModelMessage[] {
  const toolCallId = `call-${turn}`;
  return [
    { role: "user", content: userText },
    {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId, toolName: "officecli", input: {} },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId,
          toolName: "officecli",
          output: { type: "text", value: "x".repeat(outputLength) },
        },
      ],
    },
    { role: "assistant", content: `reply ${turn}` },
  ];
}

describe("estimateTokens", () => {
  test("chars / 4 rounded", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abc")).toBe(1);
  });
});

describe("selectPruneTargets", () => {
  test("prunes older tool outputs beyond the protect budget, keeps newest", () => {
    const big = 4_000; // ~1000 tokens each
    const messages = [
      ...toolTurn(1, big),
      ...toolTurn(2, big),
      ...toolTurn(3, big),
      ...toolTurn(4, big),
    ];
    // last two turns protected outright; turn 2 fits in the 1500-token
    // protect budget; turn 1 exceeds it -> pruned
    const selection = selectPruneTargets(messages, 1_500);
    expect(selection.targets).toHaveLength(1);
    expect(selection.targets[0].msgIndex).toBe(2); // turn 1's tool message
    expect(selection.pruned).toBe(1_000);
  });

  test("last two turns of tool output are never pruned", () => {
    const huge = 200_000; // ~50k tokens, way over any protect budget
    const messages = [...toolTurn(1, huge), ...toolTurn(2, huge)];
    const selection = selectPruneTargets(messages, 0);
    expect(selection.targets).toHaveLength(0);
  });

  test("walks back across more turns until the budget is exceeded", () => {
    const small = 2_000; // 500 tokens each
    const messages = [
      ...toolTurn(1, small),
      ...toolTurn(2, small),
      ...toolTurn(3, small),
      ...toolTurn(4, small),
    ];
    // protect 200 tokens: turn 2 exceeds it, then turn 1 also exceeds it
    const selection = selectPruneTargets(messages, 200);
    expect(selection.pruned).toBe(1_000);
    expect(selection.targets.map((t) => t.msgIndex)).toEqual([6, 2]);
  });

  test("stops at the summary system message", () => {
    const messages = [
      { role: "system", content: "compaction summary" } as ModelMessage,
      ...toolTurn(1, 4_000),
    ];
    const selection = selectPruneTargets(messages, 0);
    expect(selection.targets).toHaveLength(0);
  });

  test("already-pruned outputs are not double-counted", () => {
    const messages = [
      ...toolTurn(1, 4_000),
      ...toolTurn(2, 4_000),
      ...toolTurn(3, 4_000),
      ...toolTurn(4, 4_000),
    ];
    messages[2].content = [
      {
        type: "tool-result",
        toolCallId: "call-1",
        toolName: "officecli",
        output: { type: "text", value: PRUNE_PLACEHOLDER },
      },
    ];
    // turns 4 and 3 protected (last two); turn 1's placeholder contributes
    // nothing; turn 2 is pruned
    const selection = selectPruneTargets(messages, 0);
    expect(selection.pruned).toBe(1_000);
    expect(selection.targets.map((t) => t.msgIndex)).toEqual([6]);
  });

  test("skill tool outputs are never pruned", () => {
    const messages = [
      ...toolTurn(1, 4_000),
      ...toolTurn(2, 4_000),
      ...toolTurn(3, 4_000),
      ...toolTurn(4, 4_000),
    ];
    // turn 1 is a skill instruction dump — prunable range, but protected
    messages[2].content = [
      {
        type: "tool-result",
        toolCallId: "call-1",
        toolName: "skill",
        output: { type: "text", value: "y".repeat(40_000) },
      },
    ];
    const selection = selectPruneTargets(messages, 0);
    expect(selection.targets.map((t) => t.msgIndex)).toEqual([6]);
  });
});

describe("applyPrune", () => {
  test("replaces selected outputs with the placeholder, shape preserved", () => {
    const messages = [
      ...toolTurn(1, 4_000),
      ...toolTurn(2, 4_000),
      ...toolTurn(3, 4_000),
    ];
    const selection = selectPruneTargets(messages, 0);
    const freed = applyPrune(messages, selection);
    expect(freed).toBe(selection.pruned);
    const toolMsg = messages[2];
    expect(toolMsg.role).toBe("tool");
    const part = (toolMsg.content as any[])[0];
    expect(part.type).toBe("tool-result");
    expect(part.output.value).toBe(PRUNE_PLACEHOLDER);
    expect(messages).toHaveLength(12);
    expect(messages[0].role).toBe("user");
    expect(messages[3].role).toBe("assistant");
    // protected newest turns untouched
    expect((messages[6].content as any[])[0].output.value).toBe(
      "x".repeat(4_000)
    );
    expect((messages[10].content as any[])[0].output.value).toBe(
      "x".repeat(4_000)
    );
  });
});

describe("pruneSession", () => {
  let dir: string;
  let store: SessionStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oo-prune-"));
    store = new SessionStore(join(dir, "test.db"));
  });

  const makeSession = (messages: ModelMessage[]): Session => ({
    id: randomUUID(),
    agent: "build",
    model: "anthropic/claude-sonnet-4-6",
    title: "T",
    cwd: process.cwd(),
    messages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  test("commits only when freed tokens exceed the minimum", async () => {
    const messages = [
      ...toolTurn(1, 4_000),
      ...toolTurn(2, 4_000),
      ...toolTurn(3, 4_000),
    ];
    const session = makeSession(messages);
    store.save(session);
    store.replaceMessages(session.id, messages);

    const config: Config = {
      compaction: { pruneProtectTokens: 0, pruneMinimumTokens: 10_000 },
    };
    const changed = await pruneSession({ session, store, config });
    expect(changed).toBe(false);

    const loaded = store.load(session.id)!;
    expect((loaded.messages[2].content as any[])[0].output.value).toBe(
      "x".repeat(4_000)
    );
  });

  test("persists pruned outputs to the store and memory", async () => {
    const messages = [
      ...toolTurn(1, 4_000),
      ...toolTurn(2, 4_000),
      ...toolTurn(3, 4_000),
    ];
    const session = makeSession(messages);
    store.save(session);
    store.replaceMessages(session.id, messages);

    const config: Config = {
      compaction: { pruneProtectTokens: 0, pruneMinimumTokens: 0 },
    };
    const changed = await pruneSession({ session, store, config });
    expect(changed).toBe(true);

    const loaded = store.load(session.id)!;
    expect(loaded.messages).toHaveLength(12);
    expect((loaded.messages[2].content as any[])[0].output.value).toBe(
      PRUNE_PLACEHOLDER
    );
    expect((session.messages[2].content as any[])[0].output.value).toBe(
      PRUNE_PLACEHOLDER
    );
    // protected newest turns untouched
    expect((loaded.messages[6].content as any[])[0].output.value).toBe(
      "x".repeat(4_000)
    );
    expect((loaded.messages[10].content as any[])[0].output.value).toBe(
      "x".repeat(4_000)
    );
  });

  test("protect turns follow compaction.tailTurns", async () => {
    const messages = [
      ...toolTurn(1, 4_000),
      ...toolTurn(2, 4_000),
      ...toolTurn(3, 4_000),
    ];
    const session = makeSession(messages);
    store.save(session);
    store.replaceMessages(session.id, messages);

    // tail of 1: turn 3 protected, turns 1-2 pruned
    const config: Config = {
      compaction: {
        tailTurns: 1,
        pruneProtectTokens: 0,
        pruneMinimumTokens: 0,
      },
    };
    const changed = await pruneSession({ session, store, config });
    expect(changed).toBe(true);

    expect((session.messages[2].content as any[])[0].output.value).toBe(
      PRUNE_PLACEHOLDER
    );
    expect((session.messages[6].content as any[])[0].output.value).toBe(
      PRUNE_PLACEHOLDER
    );
    expect((session.messages[10].content as any[])[0].output.value).toBe(
      "x".repeat(4_000)
    );
  });
});
