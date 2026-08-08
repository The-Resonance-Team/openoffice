import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  executeTool,
  ToolRegistry,
  on,
  type ToolDefinition,
} from "@openoffice/core";

const echoTool: ToolDefinition = {
  name: "echo",
  description: "Echoes input back",
  parameters: z.object({ message: z.string() }),
  execute: async (params) => ({
    success: true as const,
    output: params.message,
  }),
};

const failTool: ToolDefinition = {
  name: "fail",
  description: "Always fails",
  parameters: z.object({}),
  execute: async () => {
    throw new Error("boom");
  },
};

describe("ToolRegistry", () => {
  test("register and get", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    expect(reg.get("echo")).toBe(echoTool);
    expect(reg.get("nope")).toBeUndefined();
  });

  test("list returns all registered tools", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    reg.register(failTool);
    expect(reg.list()).toHaveLength(2);
  });

  test("toAITools converts all tools", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const ai = reg.toAITools();
    expect(ai.echo).toBeDefined();
    expect(typeof ai.echo).toBe("object");
  });

  test("toAIToolsWithEvents emits tool:start and tool:done", async () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const events: string[] = [];
    const unsub1 = on("tool:start", () => events.push("start"));
    const unsub2 = on("tool:done", () => events.push("done"));

    const ai = reg.toAIToolsWithEvents("session-1");
    // Execute the tool directly (simulating what AI SDK does)
    const result = await ai.echo.execute({ message: "hi" });
    expect(result.success).toBe(true);
    expect(events).toEqual(["start", "done"]);

    unsub1();
    unsub2();
  });
});

describe("executeTool", () => {
  test("valid params returns success", async () => {
    const result = await executeTool(echoTool, { message: "hi" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.output).toBe("hi");
  });

  test("invalid params returns validation error", async () => {
    const result = await executeTool(echoTool, { wrong: true });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("VALIDATION_ERROR");
  });

  test("execution error returns wrapped error", async () => {
    const result = await executeTool(failTool, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("boom");
      expect(result.code).toBe("EXECUTION_ERROR");
    }
  });
});
