import { describe, expect, test } from "bun:test";
import { redact } from "./redact";

describe("redact", () => {
  test("redacts exact string match", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    expect(redact("my key is sk-abc123xyz here", secrets)).toBe("[redacted]");
  });

  test("redacts substring match in a larger string", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    expect(redact("https://api.example.com?key=sk-abc123xyz", secrets)).toBe(
      "[redacted]"
    );
  });

  test("does not redact unrelated strings", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    expect(redact("hello world", secrets)).toBe("hello world");
  });

  test("redacts in nested objects", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    const input = { a: { b: "key=sk-abc123xyz", c: "safe" }, d: "safe" };
    expect(redact(input, secrets)).toEqual({
      a: { b: "[redacted]", c: "safe" },
      d: "safe",
    });
  });

  test("redacts in arrays", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    const input = ["safe", "key=sk-abc123xyz", ["nested sk-abc123xyz"]];
    expect(redact(input, secrets)).toEqual([
      "safe",
      "[redacted]",
      ["[redacted]"],
    ]);
  });

  test("does not mutate the original object", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    const input = { key: "sk-abc123xyz" };
    redact(input, secrets);
    expect(input.key).toBe("sk-abc123xyz");
  });

  test("handles non-string primitives gracefully", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    expect(redact(42, secrets)).toBe(42);
    expect(redact(true, secrets)).toBe(true);
    expect(redact(null, secrets)).toBe(null);
    expect(redact(undefined, secrets)).toBe(undefined);
  });

  test("redacts multiple secrets in the same string", () => {
    const secrets = new Set(["sk-abc123xyz", "ghp-def456uvw"]);
    expect(redact("keys: sk-abc123xyz and ghp-def456uvw", secrets)).toBe(
      "[redacted]"
    );
  });

  test("empty sensitive set passes through unchanged", () => {
    expect(redact("anything", new Set())).toBe("anything");
  });

  test("redacts ToolResult-style data", () => {
    const secrets = new Set(["sk-abc123xyz"]);
    const result = {
      success: true,
      output: "Used key sk-abc123xyz to authenticate",
      data: { token: "sk-abc123xyz", status: "ok" },
    };
    expect(redact(result, secrets)).toEqual({
      success: true,
      output: "[redacted]",
      data: { token: "[redacted]", status: "ok" },
    });
  });
});
