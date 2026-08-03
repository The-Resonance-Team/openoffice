import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  lookupLimits,
  usableTokens,
  getModelLimits,
  type LimitsCatalog,
} from "../context-window";
import type { Config } from "../../config";

const catalog: LimitsCatalog = {
  anthropic: {
    models: {
      "claude-sonnet-4-6": { limit: { context: 1_000_000, output: 128_000 } },
      "claude-haiku-4-5": { limit: { context: 200_000, output: 64_000 } },
    },
  },
  ollama: {
    models: {
      "llama-3.1-8b-instruct": { limit: { context: 128_000, output: 8_192 } },
    },
  },
};

describe("lookupLimits", () => {
  test("exact provider and model id resolves", () => {
    expect(lookupLimits(catalog, "anthropic/claude-sonnet-4-6")).toEqual({
      context: 1_000_000,
      output: 128_000,
    });
  });

  test("unknown provider falls back to a model-id search across providers", () => {
    expect(lookupLimits(catalog, "mylocal/llama-3.1-8b-instruct")).toEqual({
      context: 128_000,
      output: 8_192,
    });
  });

  test("unknown model id returns undefined", () => {
    expect(lookupLimits(catalog, "anthropic/nonexistent")).toBeUndefined();
    expect(lookupLimits(catalog, "mylocal/ghost-model")).toBeUndefined();
  });

  test("empty catalog returns undefined", () => {
    expect(lookupLimits({}, "anthropic/claude-sonnet-4-6")).toBeUndefined();
  });
});

describe("usableTokens", () => {
  test("reserves min(20_000, output) of output headroom", () => {
    expect(usableTokens({ context: 200_000, output: 64_000 }, undefined)).toBe(
      180_000
    );
    expect(
      usableTokens({ context: 1_000_000, output: 128_000 }, undefined)
    ).toBe(980_000);
  });

  test("small output limit caps the reserved buffer", () => {
    expect(usableTokens({ context: 128_000, output: 8_192 }, undefined)).toBe(
      119_808
    );
  });

  test("config reservedTokens overrides the buffer", () => {
    const config: Config = { compaction: { reservedTokens: 150_000 } };
    expect(usableTokens({ context: 200_000, output: 64_000 }, config)).toBe(
      50_000
    );
  });

  test("zero context disables the window", () => {
    expect(usableTokens({ context: 0, output: 8_192 }, undefined)).toBe(0);
  });
});

describe("getModelLimits", () => {
  let dir: string;
  let oldHome: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oo-cw-"));
    oldHome = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = dir;
  });

  afterEach(() => {
    if (oldHome === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = oldHome;
  });

  const offlineFetch = () =>
    Promise.reject(new Error("offline (test)")).then(() => new Response());

  test("falls back to the vendored snapshot when offline with no cache", async () => {
    const limits = await getModelLimits(
      "anthropic/claude-sonnet-4-6",
      undefined,
      offlineFetch
    );
    expect(limits).toEqual({ context: 1_000_000, output: 128_000 });
  });

  test("offline with no cache resolves compatible-host models by id", async () => {
    const limits = await getModelLimits(
      "deepseek/deepseek-chat",
      undefined,
      offlineFetch
    );
    expect(limits).not.toBeUndefined();
  });

  test("unknown model offline returns undefined", async () => {
    const limits = await getModelLimits(
      "anthropic/does-not-exist-7b",
      undefined,
      offlineFetch
    );
    expect(limits).toBeUndefined();
  });

  test("a fresh cache file is used without fetching", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(dir, "models.json"), JSON.stringify(catalog), "utf8");
    const fetchSpy = () => {
      throw new Error("should not fetch");
    };
    const limits = await getModelLimits(
      "anthropic/claude-haiku-4-5",
      undefined,
      fetchSpy as any
    );
    expect(limits).toEqual({ context: 200_000, output: 64_000 });
  });

  test("a per-model config override wins over the catalog", async () => {
    const config: Config = {
      compaction: {
        windows: {
          "anthropic/claude-sonnet-4-6": { context: 42_000, output: 4_000 },
        },
      },
    };
    const limits = await getModelLimits(
      "anthropic/claude-sonnet-4-6",
      config,
      offlineFetch
    );
    expect(limits).toEqual({ context: 42_000, output: 4_000 });
  });
});
