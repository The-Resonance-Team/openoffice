import { describe, expect, test } from "bun:test";
import {
  estimateTokens,
  partText,
  isSummaryMessage,
  summaryText,
  completedCompactions,
  turns,
  type WithParts,
} from "../parts";

function msg(overrides: Partial<WithParts> = {}): WithParts {
  return {
    info: {
      id: "m1",
      role: "user",
      time: { created: 0 },
    },
    parts: [],
    ...overrides,
  };
}

describe("estimateTokens", () => {
  test("approximates tokens from serialized length", () => {
    expect(estimateTokens("abcd")).toBe(2);
    expect(estimateTokens({ a: 1 })).toBe(2);
    expect(estimateTokens("")).toBe(1);
  });
});

describe("partText", () => {
  test("returns output for completed tool parts", () => {
    const part = {
      type: "tool" as const,
      tool: "x",
      state: { status: "completed" as const, input: "{}", output: "result" },
    };
    expect(partText(part)).toBe("result");
  });

  test("returns error message for errored tool parts", () => {
    const part = {
      type: "tool" as const,
      tool: "x",
      state: {
        status: "error" as const,
        input: "{}",
        error: { message: "boom" },
      },
    };
    expect(partText(part)).toBe("boom");
  });

  test("returns empty for pending tool parts", () => {
    const part = {
      type: "tool" as const,
      tool: "x",
      state: { status: "pending" as const, input: "{}" },
    };
    expect(partText(part)).toBe("");
  });
});

describe("isSummaryMessage", () => {
  test("true when summary flag and finish set, no error", () => {
    const m = msg({
      info: {
        id: "m1",
        role: "assistant",
        summary: true,
        finish: "done",
        time: { created: 0 },
      },
    });
    expect(isSummaryMessage(m)).toBe(true);
  });

  test("false when summary missing or error present", () => {
    expect(isSummaryMessage(msg())).toBe(false);
    expect(
      isSummaryMessage(
        msg({
          info: {
            id: "m1",
            role: "assistant",
            summary: true,
            finish: "error",
            error: { message: "boom" },
            time: { created: 0 },
          },
        })
      )
    ).toBe(false);
  });
});

describe("summaryText", () => {
  test("joins trimmed text parts", () => {
    const m = msg({
      info: { id: "m1", role: "assistant", time: { created: 0 } },
      parts: [
        { type: "text", text: "  first  " },
        { type: "text", text: "" },
        { type: "text", text: "second" },
        { type: "tool", tool: "x", state: { status: "pending", input: "" } },
      ],
    });
    expect(summaryText(m)).toBe("first\n\nsecond");
  });

  test("undefined when only empty/whitespace text", () => {
    const m = msg({
      info: { id: "m1", role: "assistant", time: { created: 0 } },
      parts: [{ type: "text", text: "   " }],
    });
    expect(summaryText(m)).toBeUndefined();
  });
});

describe("completedCompactions", () => {
  test("pairs compaction user message with following summary assistant message", () => {
    const user = msg({
      info: { id: "u1", role: "user", time: { created: 0 } },
      parts: [{ type: "compaction", auto: true }],
    });
    const summary = msg({
      info: {
        id: "a1",
        role: "assistant",
        parentID: "u1",
        summary: true,
        finish: "done",
        time: { created: 1 },
      },
      parts: [{ type: "text", text: "done" }],
    });
    const other = msg({
      info: { id: "a2", role: "assistant", time: { created: 2 } },
    });

    const result = completedCompactions([user, summary, other]);
    expect(result).toEqual([
      { userIndex: 0, assistantIndex: 1, summary: "done" },
    ]);
  });

  test("ignores orphaned summaries and non-summary assistants", () => {
    const user = msg({
      info: { id: "u1", role: "user", time: { created: 0 } },
      parts: [{ type: "compaction", auto: true }],
    });
    const orphan = msg({
      info: {
        id: "a1",
        role: "assistant",
        summary: true,
        finish: "done",
        time: { created: 1 },
      },
      parts: [{ type: "text", text: "x" }],
    });
    expect(completedCompactions([user, orphan])).toEqual([]);
  });
});

describe("turns", () => {
  test("one turn per user message, ending where next begins", () => {
    const u1 = msg({ info: { id: "u1", role: "user", time: { created: 0 } } });
    const a1 = msg({
      info: { id: "a1", role: "assistant", time: { created: 1 } },
    });
    const u2 = msg({ info: { id: "u2", role: "user", time: { created: 2 } } });
    const compact = msg({
      info: { id: "u3", role: "user", time: { created: 3 } },
      parts: [{ type: "compaction", auto: true }],
    });

    expect(turns([u1, a1, u2, compact])).toEqual([
      { start: 0, end: 2, id: "u1" },
      { start: 2, end: 4, id: "u2" },
    ]);
  });
});
