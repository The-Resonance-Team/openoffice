import { z } from "zod";
import type { Todo } from "@openoffice/schema";
import type { ToolDefinition } from "../types";
import type { SessionStore } from "../../session";
import { emit } from "../../events";

const todoSchema = z.object({
  content: z.string().min(1),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  priority: z.enum(["high", "medium", "low"]),
});

const parameters = z.object({
  todos: z.array(todoSchema),
});

const DESCRIPTION = `Create and maintain a structured task list for the current session. Tracks progress, organizes multi-step work, and surfaces status to the user.

Use proactively when:
- The task requires 3+ distinct steps or actions (not just 3 tool calls for a single conceptual step)
- The work is non-trivial and benefits from planning
- The user provides multiple tasks (numbered or comma-separated) or explicitly asks for a todo list

Rules:
- Exactly one todo is "in_progress" at a time
- Mark a todo "completed" only after the required work is actually done, including any required verification
- Each call writes the WHOLE list: it replaces the previous list, it is not a merge
- Keep todos specific and actionable; break large work into smaller steps`;

export function createTodoTool(deps: { store: SessionStore }): ToolDefinition {
  return {
    name: "todo",
    description: DESCRIPTION,
    parameters,
    execute: async (
      params: unknown,
      ctx
    ): Promise<
      { success: true; output: string } | { success: false; error: string }
    > => {
      const parsed = parameters.safeParse(params);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid todos: ${parsed.error.message}`,
        };
      }
      const todos: Todo[] = parsed.data.todos;
      deps.store.setTodos(ctx.sessionID, todos);
      emit("todo:updated", { sessionID: ctx.sessionID, todos });
      return { success: true, output: JSON.stringify(todos, null, 2) };
    },
  };
}
