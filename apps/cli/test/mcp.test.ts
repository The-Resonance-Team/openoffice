import { describe, expect, test } from "bun:test";
import { McpManager, type McpClient } from "../src/mcp";

function createMockClient(
  tools: Array<{ name: string; description: string }> = []
): McpClient {
  return {
    name: "",
    listTools: async () => tools.map((t) => ({ ...t, inputSchema: {} })),
    callTool: async (name: string, args: Record<string, unknown>) => ({
      result: `called ${name}`,
      args,
    }),
    close: async () => {},
  };
}

describe("McpManager", () => {
  test("connects to server", async () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    await manager.connect("test", {
      type: "local",
      command: ["npx", "server"],
    });
    expect(manager.status().test).toBe("connected");
  });

  test("lists tools from all connected servers", async () => {
    const manager = new McpManager({
      connect: async () =>
        createMockClient([
          { name: "send", description: "Send message" },
          { name: "read", description: "Read message" },
        ]),
    });
    await manager.connect("gmail", {
      type: "local",
      command: ["npx", "gmail"],
    });
    await manager.connect("slack", {
      type: "local",
      command: ["npx", "slack"],
    });

    const tools = await manager.listAllTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => `${t.clientName}_${t.name}`).sort()).toEqual([
      "gmail_read",
      "gmail_send",
      "slack_read",
      "slack_send",
    ]);
  });

  test("generates namespaced tool names", () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    expect(manager.toolName("gmail", "send_email")).toBe("gmail_send_email");
  });

  test("calls tool on correct client", async () => {
    let calledClient = "";
    let calledTool = "";
    const manager = new McpManager({
      connect: async () =>
        ({
          name: "",
          listTools: async () => [],
          callTool: async (name: string) => {
            calledClient = "gmail";
            calledTool = name;
            return { sent: true };
          },
          close: async () => {},
        }) as McpClient,
    });
    await manager.connect("gmail", { type: "local", command: [] });

    const result = await manager.callTool("gmail", "send", {
      to: "test@test.com",
    });
    expect(result.success).toBe(true);
    expect(calledClient).toBe("gmail");
    expect(calledTool).toBe("send");
  });

  test("returns error for unknown client", async () => {
    const manager = new McpManager({
      connect: async () => createMockClient(),
    });
    const result = await manager.callTool("nonexistent", "tool", {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("MCP_NOT_CONNECTED");
  });

  test("disconnects all clients", async () => {
    let closed = false;
    const manager = new McpManager({
      connect: async () =>
        ({
          name: "",
          listTools: async () => [],
          callTool: async () => ({}),
          close: async () => {
            closed = true;
          },
        }) as McpClient,
    });
    await manager.connect("test", { type: "local", command: [] });
    await manager.disconnectAll();
    expect(closed).toBe(true);
    expect(manager.status()).toEqual({});
  });
});
