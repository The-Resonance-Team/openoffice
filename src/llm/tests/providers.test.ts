import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CredentialStore } from "../../auth/store";
import {
  resolveCredential,
  resolveModel,
  AuthRequiredError,
} from "../providers";
import type { Config } from "../../config";

let dir: string;
let store: CredentialStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-llm-"));
  store = new CredentialStore(join(dir, "auth.json"));
});

const anthropicConfig = (apiKey?: string): Config => ({
  model: "anthropic/claude-sonnet-4-20250514",
  provider: { anthropic: { apiKey } },
});

describe("resolveCredential — resolution order", () => {
  test("config apiKey beats a stored credential", () => {
    store.set("anthropic", { type: "api", key: "sk-store" });
    const result = resolveCredential(
      anthropicConfig("sk-config").provider?.anthropic,
      "anthropic",
      store
    );
    expect(result).toEqual({ apiKey: "sk-config" });
  });

  test("stored api credential fills an undeclared key", () => {
    store.set("anthropic", { type: "api", key: "sk-store" });
    const result = resolveCredential(
      anthropicConfig(undefined).provider?.anthropic,
      "anthropic",
      store
    );
    expect(result).toEqual({ apiKey: "sk-store" });
  });

  test("declared provider with no key anywhere raises a clear error naming both fixes", () => {
    expect(() =>
      resolveCredential(
        anthropicConfig(undefined).provider?.anthropic,
        "anthropic",
        store
      )
    ).toThrow(/anthropic.*apiKey.*auth login anthropic/);
  });

  test("missing credential is an AuthRequiredError naming the provider", () => {
    let thrown: unknown;
    try {
      resolveCredential(
        anthropicConfig(undefined).provider?.anthropic,
        "anthropic",
        store
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthRequiredError);
    expect((thrown as AuthRequiredError).provider).toBe("anthropic");
  });

  test("undeclared provider with no stored credential returns empty (SDK env fallback)", () => {
    const result = resolveCredential(undefined, "anthropic", store);
    expect(result).toEqual({});
  });
});

describe("resolveCredential — oauth expiry", () => {
  test("unexpired oauth credential hands the access token as authToken", () => {
    store.set("anthropic", {
      type: "oauth",
      access: "tok-1",
      refresh: "ref-1",
      expires: Date.now() + 60_000,
    });
    const result = resolveCredential(undefined, "anthropic", store);
    expect(result).toEqual({ authToken: "tok-1" });
  });

  test("expired oauth credential raises a re-login error", () => {
    store.set("anthropic", {
      type: "oauth",
      access: "tok-1",
      expires: Date.now() - 1,
    });
    let thrown: unknown;
    try {
      resolveCredential(undefined, "anthropic", store);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthRequiredError);
    expect((thrown as AuthRequiredError).provider).toBe("anthropic");
    expect((thrown as Error).message).toMatch(/expired.*auth login anthropic/);
  });

  test("credential expiring in the future is still usable", () => {
    store.set("anthropic", {
      type: "oauth",
      access: "tok-1",
      expires: Date.now() + 60_000,
    });
    const result = resolveCredential(undefined, "anthropic", store);
    expect(result.authToken).toBe("tok-1");
  });
});

describe("resolveModel", () => {
  test("declared provider with nothing resolving raises the clear error", () => {
    expect(() =>
      resolveModel(
        "anthropic/claude-sonnet-4-20250514",
        anthropicConfig(undefined),
        store
      )
    ).toThrow(/no credential/);
  });

  test("stored credential satisfies a declared provider", () => {
    store.set("anthropic", { type: "api", key: "sk-store" });
    const model = resolveModel(
      "anthropic/claude-sonnet-4-20250514",
      anthropicConfig(undefined),
      store
    );
    expect(model).toBeDefined();
    expect(model.modelId).toBe("claude-sonnet-4-20250514");
  });

  test("unknown provider is rejected before any credential lookup", () => {
    expect(() =>
      resolveModel("nope/gpt-0", anthropicConfig("sk-config"), store)
    ).toThrow(/Unknown provider "nope"/);
  });

  test("malformed model string is rejected", () => {
    expect(() =>
      resolveModel("no-slash", anthropicConfig("sk-config"), store)
    ).toThrow(/provider\/model-id/);
  });
});
