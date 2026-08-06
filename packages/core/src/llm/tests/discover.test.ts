import { describe, expect, test } from "bun:test";
import { discoverLocalModels } from "../discover";

function mockFetch(routes: Record<string, unknown>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const route = routes[url];
    if (route === undefined) {
      return new Response("not found", { status: 404 });
    }
    if (route instanceof Error) throw route;
    return new Response(JSON.stringify(route), { status: 200 });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("discoverLocalModels", () => {
  test("collects models from every reachable server, skipping unreachable ones", async () => {
    const restore = mockFetch({
      "http://localhost:11434/api/tags": { models: [{ name: "llama3.1" }] },
      "http://localhost:8000/v1/models": {
        data: [{ id: "meta-llama/Llama-3.1-8B" }],
      },
      // llama.cpp (:8080) returns 404 — skipped
    });
    try {
      const found = await discoverLocalModels(100);
      expect(found).toEqual([
        { server: "ollama", models: ["llama3.1"] },
        { server: "vLLM", models: ["meta-llama/Llama-3.1-8B"] },
      ]);
    } finally {
      restore();
    }
  });

  test("returns empty when nothing is running", async () => {
    const restore = mockFetch({
      "http://localhost:11434/api/tags": new Error("connection refused"),
      "http://localhost:8080/v1/models": new Error("connection refused"),
      "http://localhost:8000/v1/models": new Error("connection refused"),
    });
    try {
      expect(await discoverLocalModels(100)).toEqual([]);
    } finally {
      restore();
    }
  });
});
