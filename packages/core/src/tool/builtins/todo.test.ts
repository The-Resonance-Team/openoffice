import { describe, expect, test } from "bun:test";
import { createTodoTool, type TodoDeps } from "./todo";
import { on } from "../../events";

function fakeStore(): TodoDeps & {
  writes: unknown[][];
} {
  const writes: unknown[][] = [];
  return {
    writes,
    getTodos: () => [],
    setTodos: (_sessionId: string, todos: unknown[]) => writes.push(todos),
  };
}

describe("todo tool", () => {
  test("writes the full list and returns it as JSON", async () => {
    const store = fakeStore();
    const tool = createTodoTool(store);
    const result = await tool.execute(
      {
        todos: [
          { content: "draft", status: "in_progress", priority: "high" },
          { content: "review", status: "pending", priority: "low" },
        ],
      },
      { sessionID: "s1" }
    );

    expect(result.success).toBe(true);
    expect(store.writes).toEqual([
      [
        { content: "draft", status: "in_progress", priority: "high" },
        { content: "review", status: "pending", priority: "low" },
      ],
    ]);
    const output = (result as { output: string }).output;
    expect(JSON.parse(output)).toEqual([
      { content: "draft", status: "in_progress", priority: "high" },
      { content: "review", status: "pending", priority: "low" },
    ]);
  });

  test("emits todo:updated with the session id and the new list", async () => {
    const store = fakeStore();
    const tool = createTodoTool(store);
    const events: unknown[] = [];
    const off = on("todo:updated", (data) => events.push(data));
    try {
      await tool.execute(
        { todos: [{ content: "x", status: "pending", priority: "medium" }] },
        { sessionID: "s1" }
      );
    } finally {
      off();
    }
    expect(events).toEqual([
      {
        sessionID: "s1",
        todos: [{ content: "x", status: "pending", priority: "medium" }],
      },
    ]);
  });

  test("rejects an invalid status without writing", async () => {
    const store = fakeStore();
    const tool = createTodoTool(store);
    const result = await tool.execute(
      { todos: [{ content: "x", status: "blocked", priority: "high" }] },
      { sessionID: "s1" }
    );

    expect(result.success).toBe(false);
    expect(store.writes).toEqual([]);
  });
});
