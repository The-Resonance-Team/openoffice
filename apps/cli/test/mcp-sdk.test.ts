import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSdkMcpClient,
  normalizeMcpResult,
  normalizeMcpContents,
  planMcpConnections,
  type McpConfig,
} from "@openoffice/core";

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

  test("enabled:false servers are excluded from boot connect", () => {
    const { toConnect, skipped, disabled } = planMcpConnections(
      {
        on: { type: "local", command: ["npx", "x"] },
        off: { type: "local", command: ["npx", "y"], enabled: false },
        officecli: { type: "local", command: ["officecli", "mcp"] },
      },
      native
    );
    expect(disabled).toEqual(["off"]);
    expect(skipped).toEqual(["officecli"]);
    expect(toConnect.map(([n]) => n)).toEqual(["on"]);
  });

  test("disabled wins over dogfooding", () => {
    const { toConnect, skipped, disabled } = planMcpConnections(
      { read: { type: "local", command: ["x"], enabled: false } },
      native
    );
    expect(disabled).toEqual(["read"]);
    expect(skipped).toEqual([]);
    expect(toConnect).toEqual([]);
  });
});

describe("normalizeMcpContents", () => {
  test("joins text contents", () => {
    expect(
      normalizeMcpContents([
        { uri: "mem://a", text: "a" },
        { uri: "mem://b", text: "b" },
      ])
    ).toBe("a\nb");
  });

  test("throws on binary (blob) content", () => {
    expect(() =>
      normalizeMcpContents([{ uri: "mem://a", blob: "AAAA" }])
    ).toThrow("binary content");
  });

  test("throws on empty content", () => {
    expect(() => normalizeMcpContents([])).toThrow("no content");
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
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "test-server", version: "1.0.0" },
  { capabilities: { tools: {}, prompts: {}, resources: {} } }
);
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
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [{ name: "summarize", description: "Summarize a document" }],
}));
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: "mem://notes/hello", name: "Hello note" }],
}));
server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri !== "mem://notes/hello") throw new Error("unknown resource " + req.params.uri);
  return { contents: [{ uri: req.params.uri, mimeType: "text/plain", text: "hello resource" }] };
});
await server.connect(new StdioServerTransport());
`
  );

  const toolsOnlyScript = join(dir, "tools-only.ts");
  writeFileSync(
    toolsOnlyScript,
    `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "tools-only", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
await server.connect(new StdioServerTransport());
`
  );

  const promptsOnlyScript = join(dir, "prompts-only.ts");
  writeFileSync(
    promptsOnlyScript,
    `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "prompts-only", version: "1.0.0" }, { capabilities: { prompts: {} } });
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [{ name: "draft", description: "Draft a doc" }],
}));
await server.connect(new StdioServerTransport());
`
  );

  const config: McpConfig = {
    type: "local",
    command: [process.execPath, serverScript],
  };
  const toolsOnlyConfig: McpConfig = {
    type: "local",
    command: [process.execPath, toolsOnlyScript],
  };
  const promptsOnlyConfig: McpConfig = {
    type: "local",
    command: [process.execPath, promptsOnlyScript],
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

  test("lists prompts and resources and reads a resource", async () => {
    expect(await client!.listPrompts()).toEqual([
      { name: "summarize", description: "Summarize a document" },
    ]);
    expect(await client!.listResources()).toEqual([
      { uri: "mem://notes/hello", name: "Hello note" },
    ]);
    expect(await client!.readResource("mem://notes/hello")).toBe(
      "hello resource"
    );
  });

  test("tools-only server yields no prompts or resources (capability guard)", async () => {
    const toolsOnly = await createSdkMcpClient(toolsOnlyConfig);
    try {
      expect(await toolsOnly.listPrompts()).toEqual([]);
      expect(await toolsOnly.listResources()).toEqual([]);
    } finally {
      await toolsOnly.close();
    }
  });

  test("prompts-only server yields no tools but keeps its prompts", async () => {
    const promptsOnly = await createSdkMcpClient(promptsOnlyConfig);
    try {
      expect(await promptsOnly.listTools()).toEqual([]);
      expect(await promptsOnly.listPrompts()).toEqual([
        { name: "draft", description: "Draft a doc" },
      ]);
    } finally {
      await promptsOnly.close();
    }
  });
});
