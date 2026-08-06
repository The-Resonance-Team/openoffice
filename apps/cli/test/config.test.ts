import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectConfig, stripJsonc } from "@openoffice/core";
import { resolveConfig } from "@openoffice/core";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "openoffice-test-"));
}

const emptyEnv: Record<string, string> = {};

describe("config loading", () => {
  test("loads a valid project config", () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "openoffice.json"),
      JSON.stringify({
        model: "gpt-4o",
        provider: { openai: { apiKey: "sk-test" } },
        agent: {
          main: { description: "docs", tools: ["office"], model: "claude" },
        },
        mcp: { fs: { type: "local", command: ["npx", "server"] } },
        office: { managedDocumentsFolder: "~/docs" },
        grep: { officeExtractLimit: 7 },
      })
    );
    const config = resolveConfig({
      globalPath: join(dir, "missing.json"),
      projectPath: join(dir, "openoffice.json"),
      env: emptyEnv,
    });
    expect(config.model).toBe("gpt-4o");
    expect(config.provider?.openai?.apiKey).toBe("sk-test");
    expect(config.agent?.main?.tools).toEqual(["office"]);
    expect(config.mcp?.fs?.type).toBe("local");
    expect(config.mcp?.fs?.command).toEqual(["npx", "server"]);
    expect(config.grep?.officeExtractLimit).toBe(7);
  });

  test("missing config falls back to defaults", () => {
    const dir = tempDir();
    const config = resolveConfig({
      globalPath: join(dir, "missing.json"),
      projectPath: join(dir, "missing.json"),
      env: emptyEnv,
    });
    expect(config).toEqual({});
  });

  test("invalid JSON throws with the file path", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(path, "{ not json");
    expect(() =>
      resolveConfig({
        globalPath: join(dir, "missing.json"),
        projectPath: path,
        env: emptyEnv,
      })
    ).toThrow(/invalid config .*openoffice\.json/);
  });

  test("invalid schema throws with the file path", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(
      path,
      JSON.stringify({ provider: { openai: { apiKey: 123 } } })
    );
    expect(() =>
      resolveConfig({
        globalPath: join(dir, "missing.json"),
        projectPath: path,
        env: emptyEnv,
      })
    ).toThrow(/invalid config .*openoffice\.json/);
  });

  test("project layer overrides global, nested provider records merge", () => {
    const dir = tempDir();
    const global = join(dir, "config.json");
    const project = join(dir, "openoffice.json");
    writeFileSync(
      global,
      JSON.stringify({
        model: "old",
        provider: { openai: { apiKey: "g" }, anthropic: { apiKey: "g2" } },
      })
    );
    writeFileSync(
      project,
      JSON.stringify({ model: "new", provider: { openai: { apiKey: "p" } } })
    );
    const config = resolveConfig({
      globalPath: global,
      projectPath: project,
      env: emptyEnv,
    });
    expect(config.model).toBe("new");
    expect(config.provider?.openai?.apiKey).toBe("p");
    expect(config.provider?.anthropic?.apiKey).toBe("g2");
  });

  test("OPENOFFICE_* overrides top-level scalar fields", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(path, JSON.stringify({ model: "old" }));
    const config = resolveConfig({
      globalPath: join(dir, "missing.json"),
      projectPath: path,
      env: { OPENOFFICE_MODEL: "new-model" },
    });
    expect(config.model).toBe("new-model");
  });

  test("env: references resolve from the environment", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(
      path,
      JSON.stringify({ provider: { openai: { apiKey: "env:OPENAI_KEY" } } })
    );
    const config = resolveConfig({
      globalPath: join(dir, "missing.json"),
      projectPath: path,
      env: { OPENAI_KEY: "sk-123" },
    });
    expect(config.provider?.openai?.apiKey).toBe("sk-123");
  });

  test("missing env: at a provider apiKey falls through (stored credential may supply it)", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(
      path,
      JSON.stringify({ provider: { openai: { apiKey: "env:OPENAI_KEY" } } })
    );
    const config = resolveConfig({
      globalPath: join(dir, "missing.json"),
      projectPath: path,
      env: {},
    });
    expect(config.provider?.openai?.apiKey).toBeUndefined();
  });

  test("missing env: anywhere else is still a hard error", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(
      path,
      JSON.stringify({ office: { managedDocumentsFolder: "env:OOO_DOCS" } })
    );
    expect(() =>
      resolveConfig({
        globalPath: join(dir, "missing.json"),
        projectPath: path,
        env: {},
      })
    ).toThrow(/OOO_DOCS is not set/);
  });

  test("~/ expands in string values", () => {
    const dir = tempDir();
    const path = join(dir, "openoffice.json");
    writeFileSync(
      path,
      JSON.stringify({ office: { managedDocumentsFolder: "~/docs" } })
    );
    const config = resolveConfig({
      globalPath: join(dir, "missing.json"),
      projectPath: path,
      env: emptyEnv,
    });
    expect(config.office?.managedDocumentsFolder).toBe(join(homedir(), "docs"));
  });

  test("findProjectConfig walks up to the git root", () => {
    const dir = tempDir();
    writeFileSync(join(dir, ".git"), "");
    const nested = join(dir, "a", "b");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(dir, "openoffice.json"), "{}");
    expect(findProjectConfig(nested)).toBe(join(dir, "openoffice.json"));
  });
});

describe("JSONC stripping", () => {
  test("strips comments and trailing commas, preserves strings", () => {
    const text = `{
      // line comment
      "model": "gpt-4o", // trailing
      "provider": { "openai": { "apiKey": "sk//not-a-comment" }, },
      /* block comment */
    }`;
    const parsed = JSON.parse(stripJsonc(text)) as { model: string };
    expect(parsed.model).toBe("gpt-4o");
    expect(
      (parsed as unknown as { provider: { openai: { apiKey: string } } })
        .provider.openai.apiKey
    ).toBe("sk//not-a-comment");
  });

  test("preserves escaped quotes inside strings", () => {
    const text = `{ "agent": { "main": { "description": "a \\"quoted\\" // thing" } } }`;
    expect(JSON.parse(stripJsonc(text))).toEqual({
      agent: { main: { description: 'a "quoted" // thing' } },
    });
  });
});
