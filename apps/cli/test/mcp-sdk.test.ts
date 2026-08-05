import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSdkMcpClient,
  normalizeMcpResult,
  planMcpConnections,
} from "../src/mcp/sdk-client";
import type { McpConfig } from "../src/mcp";

describe("normalizeMcpResult", () => {
  test("joins text content parts", () => {
    expect(
      normalizeMcpResult({
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      })
    ).toBe("a\nb");
  });

  test("skips non-text content", () => {
    expect(
      normalizeMcpResult({
        content: [
          { type: "image", data: "x" },
          { type: "text", text: "t" },
        ],
      })
    ).toBe("t");
  });

  test("falls back to JSON for empty content", () => {
    expect(normalizeMcpResult({ content: [] })).toBe(
      JSON.stringify({ content: [] })
    );
  });

  test("throws when isError is set", () => {
    expect(() =>
      normalizeMcpResult({
        content: [{ type: "text", text: "boom" }],
        isError: true,
      })
    ).toThrow("boom");
  });
});

describe("planMcpConnections (dogfooding)", () => {
  const native = ["officecli", "read"];

  test("skips servers whose name matches a native tool", () => {
    const { toConnect, skipped } = planMcpConnections(
      {
        officecli: { type: "local", command: ["officecli", "mcp"] },
        other: { type: "local", command: ["npx", "some-server"] },
      },
      native
    );
    expect(skipped).toEqual(["officecli"]);
    expect(toConnect.map(([n]) => n)).toEqual(["other"]);
  });

  test("empty config connects nothing", () => {
    const { toConnect, skipped } = planMcpConnections(undefined, native);
    expect(toConnect).toEqual([]);
    expect(skipped).toEqual([]);
  });
});

describe("createSdkMcpClient (stdio round-trip)", () => {
  const dir = mkdtempSync(join(tmpdir(), "openoffice-mcp-"));
  const serverScript = join(dir, "server.ts");
  writeFileSync(
    serverScript,
    `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "test-server", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "echo",
      description: "Echo the input",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
    { name: "fail", description: "Always fails", inputSchema: { type: "object" } },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "echo") return { content: [{ type: "text", text: "echo:" + args.text }] };
  if (name === "fail") return { content: [{ type: "text", text: "kaboom" }], isError: true };
  throw new Error("unknown tool " + name);
});
await server.connect(new StdioServerTransport());
`
  );

  const config: McpConfig = {
    type: "local",
    command: [process.execPath, serverScript],
  };
  let client: Awaited<ReturnType<typeof createSdkMcpClient>> | undefined;

  afterAll(async () => {
    if (client) await client.close();
  });

  test("connects, lists tools, calls, and closes", async () => {
    client = await createSdkMcpClient(config);
    const tools = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["echo", "fail"]);
    expect(tools[0].description).toBe("Echo the input");
    expect(tools[0].inputSchema).toHaveProperty("properties");

    expect(await client.callTool("echo", { text: "hi" })).toBe("echo:hi");
  });

  test("surfaces server errors", async () => {
    expect.assertions(1);
    try {
      await client!.callTool("fail", {});
    } catch (e) {
      expect((e as Error).message).toBe("kaboom");
    }
  });
});
