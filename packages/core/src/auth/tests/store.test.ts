import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CredentialStore, type Credential } from "../store";

const keyOf = (c?: Credential): string | undefined =>
  c?.type === "api" ? c.key : undefined;

let dir: string;
let store: CredentialStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "oo-auth-"));
  store = new CredentialStore(join(dir, "auth.json"));
});

describe("CredentialStore", () => {
  test("set then get round-trips a credential", () => {
    store.set("anthropic", { type: "api", key: "sk-ant-123" });
    expect(store.get("anthropic")).toEqual({ type: "api", key: "sk-ant-123" });
  });

  test("providers coexist in one file", () => {
    store.set("anthropic", { type: "api", key: "a" });
    store.set("openai", { type: "api", key: "b" });
    expect(store.list().sort()).toEqual(["anthropic", "openai"]);
    expect(keyOf(store.get("anthropic"))).toBe("a");
    expect(keyOf(store.get("openai"))).toBe("b");
  });

  test("set overwrites an existing credential silently", () => {
    store.set("anthropic", { type: "api", key: "old" });
    store.set("anthropic", { type: "api", key: "new" });
    expect(keyOf(store.get("anthropic"))).toBe("new");
  });

  test("remove deletes only the named entry", () => {
    store.set("anthropic", { type: "api", key: "a" });
    store.set("openai", { type: "api", key: "b" });
    expect(store.remove("anthropic")).toBe(true);
    expect(store.get("anthropic")).toBeUndefined();
    expect(keyOf(store.get("openai"))).toBe("b");
  });

  test("remove of an absent provider returns false and leaves the store intact", () => {
    store.set("anthropic", { type: "api", key: "a" });
    expect(store.remove("openai")).toBe(false);
    expect(keyOf(store.get("anthropic"))).toBe("a");
  });

  test("missing file reads as an empty store", () => {
    expect(store.list()).toEqual([]);
    expect(store.get("anthropic")).toBeUndefined();
  });

  test("writes create a 0600 file in a 0700 directory", () => {
    store.set("anthropic", { type: "api", key: "a" });
    // POSIX modes are meaningless on Windows; the write-path behavior is
    // still exercised, only the mode assertions are skipped.
    if (process.platform !== "win32") {
      const fileMode = statSync(join(dir, "auth.json")).mode & 0o777;
      const dirMode = statSync(dir).mode & 0o777;
      expect(fileMode).toBe(0o600);
      expect(dirMode).toBe(0o700);
    }
  });

  test("corrupt file raises an error naming the file instead of overwriting", () => {
    writeFileSync(join(dir, "auth.json"), "{ not json", { mode: 0o600 });
    expect(() => store.list()).toThrow(/auth\.json/);
    expect(() => store.set("anthropic", { type: "api", key: "a" })).toThrow();
    expect(() => store.get("anthropic")).toThrow();
  });

  test("non-object JSON raises the same corrupt error", () => {
    writeFileSync(join(dir, "auth.json"), "[]", { mode: 0o600 });
    expect(() => store.list()).toThrow(/corrupt/);
  });
});
