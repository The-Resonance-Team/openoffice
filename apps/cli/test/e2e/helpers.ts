import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../../src/config";

export interface LLMCall {
  index: number;
  body: any;
}

export type FakeResponse =
  | { kind: "tool-call"; name: string; args: string }
  | { kind: "text"; content: string };

export type FakeScript = (call: LLMCall) => FakeResponse;

export function officecliAvailable(): boolean {
  try {
    execFileSync("officecli", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function runOfficecli(args: string[]): any {
  const out = execFileSync("officecli", [...args, "--json"], {
    encoding: "utf-8",
    timeout: 30000,
  });
  return JSON.parse(out);
}

export function readTextViaOfficecli(file: string, path: string): string {
  const res = runOfficecli(["get", file, path]);
  return res?.data?.results?.[0]?.text ?? "";
}

/** True when the document's DOM contains the needle anywhere (texts live in
 * children, not on the container node's own text field). */
export function docContains(file: string, needle: string): boolean {
  const res = runOfficecli(["get", file, "/body"]);
  return JSON.stringify(res).includes(needle);
}

function sseChunks(chunks: object[]): Response {
  const body =
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") +
    "data: [DONE]\n\n";
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

/**
 * A scripted OpenAI-compatible chat-completions server. Each model call gets
 * the next scripted response, so a multi-step agent turn (tool call → result
 * → next call) is driven entirely by `script`.
 */
export async function startFakeLLM(
  script: FakeScript
): Promise<{ port: number; stop: () => void }> {
  let calls = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      if (req.method !== "POST") return new Response("ok");
      const body = await req.json();
      const resp = script({ index: calls++, body });
      const chunk = (delta: any, finish: string | null) => ({
        id: "chatcmpl-e2e",
        object: "chat.completion.chunk",
        created: 0,
        model: "e2e",
        choices: [{ index: 0, delta, finish_reason: finish }],
      });
      if (resp.kind === "text") {
        return sseChunks([
          chunk({ role: "assistant", content: "" }, null),
          chunk({ content: resp.content }, null),
          chunk({}, "stop"),
        ]);
      }
      return sseChunks([
        chunk({ role: "assistant", content: "" }, null),
        chunk(
          {
            tool_calls: [
              {
                index: 0,
                id: `call_${calls}`,
                type: "function",
                function: { name: resp.name, arguments: resp.args },
              },
            ],
          },
          null
        ),
        chunk({}, "tool_calls"),
      ]);
    },
  });
  return { port: server.port!, stop: () => server.stop(true) };
}

export function fakeConfig(baseURL: string, model = "openai/e2e"): Config {
  return {
    model,
    provider: { openai: { apiKey: "test-key", baseURL } },
  };
}

export function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}
