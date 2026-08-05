import { describe, expect, test } from "bun:test";
import { AgentRegistry, evaluate } from "../src/agent";
import type { ToolDefinition } from "../src/tool";
import { z } from "zod";

const makeTool = (name: string): ToolDefinition => ({
  name,
  description: `Tool ${name}`,
  parameters: z.object({}),
  execute: async () => ({ success: true as const, output: "" }),
});

describe("AgentRegistry", () => {
  test("has built-in office agent", () => {
    const reg = new AgentRegistry();
    const office = reg.get("office");
    expect(office).toBeDefined();
    expect(office!.name).toBe("office");
  });

  test("has built-in developer agent", () => {
    const reg = new AgentRegistry();
    const dev = reg.get("developer");
    expect(dev).toBeDefined();
    expect(dev!.name).toBe("developer");
  });

  test("default agent is office", () => {
    const reg = new AgentRegistry();
    expect(reg.getDefault().name).toBe("office");
  });

  test("list returns all agents", () => {
    const reg = new AgentRegistry();
    expect(reg.list()).toHaveLength(3);
  });

  test("unknown agent returns undefined", () => {
    const reg = new AgentRegistry();
    expect(reg.get("nonexistent")).toBeUndefined();
  });
});

describe("agent tool filtering", () => {
  test("office agent denies bash and edit", () => {
    const reg = new AgentRegistry();
    const office = reg.getDefault();
    expect(evaluate("bash", office.permission)).toBe("deny");
    expect(evaluate("edit", office.permission)).toBe("deny");
  });

  test("office agent allows officecli, read, write", () => {
    const reg = new AgentRegistry();
    const office = reg.getDefault();
    expect(evaluate("officecli", office.permission)).toBe("allow");
    expect(evaluate("read", office.permission)).toBe("allow");
    expect(evaluate("write", office.permission)).toBe("allow");
  });

  test("developer agent allows everything", () => {
    const reg = new AgentRegistry();
    const dev = reg.get("developer")!;
    expect(evaluate("bash", dev.permission)).toBe("allow");
    expect(evaluate("edit", dev.permission)).toBe("allow");
    expect(evaluate("officecli", dev.permission)).toBe("allow");
  });

  test("filterTools removes denied tools", () => {
    const reg = new AgentRegistry();
    const office = reg.getDefault();
    const tools = [
      makeTool("officecli"),
      makeTool("read"),
      makeTool("bash"),
      makeTool("edit"),
    ];
    const filtered = reg.filterTools(tools, office.permission);
    expect(filtered.map((t) => t.name)).toEqual(["officecli", "read"]);
  });

  test("filterTools keeps all tools for developer", () => {
    const reg = new AgentRegistry();
    const dev = reg.get("developer")!;
    const tools = [
      makeTool("officecli"),
      makeTool("read"),
      makeTool("bash"),
      makeTool("edit"),
    ];
    const filtered = reg.filterTools(tools, dev.permission);
    expect(filtered.map((t) => t.name)).toEqual([
      "officecli",
      "read",
      "bash",
      "edit",
    ]);
  });
});
