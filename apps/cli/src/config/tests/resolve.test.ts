import { describe, expect, test } from "bun:test";
import { resolveRefs } from "../resolve";
import type { Config } from "../schema";

describe("resolveRefs", () => {
  test("resolves env: references everywhere", () => {
    const config: Config = {
      provider: { anthropic: { apiKey: "env:ANTHROPIC_API_KEY" } },
      office: { managedDocumentsFolder: "env:OOO_DOCS" },
    };
    const resolved = resolveRefs(config, {
      ANTHROPIC_API_KEY: "sk-ant-1",
      OOO_DOCS: "/docs",
    });
    expect(resolved.provider?.anthropic?.apiKey).toBe("sk-ant-1");
    expect(resolved.office?.managedDocumentsFolder).toBe("/docs");
  });

  test("unset env: at provider.<name>.apiKey yields undefined instead of throwing", () => {
    const config: Config = {
      provider: { anthropic: { apiKey: "env:ANTHROPIC_API_KEY" } },
    };
    const resolved = resolveRefs(config, {});
    expect(resolved.provider?.anthropic?.apiKey).toBeUndefined();
  });

  test("unset env: anywhere else still throws", () => {
    const config: Config = {
      office: { managedDocumentsFolder: "env:OOO_DOCS" },
    };
    expect(() => resolveRefs(config, {})).toThrow(
      /env:OOO_DOCS but OOO_DOCS is not set/
    );
  });

  test("unset env: inside a non-apiKey provider field still throws", () => {
    const config: Config = {
      agent: { default: { description: "env:AGENT_DESC" } },
    };
    expect(() => resolveRefs(config, {})).toThrow(/AGENT_DESC/);
  });
});
