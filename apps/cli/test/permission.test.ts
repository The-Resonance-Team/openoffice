import { describe, expect, test } from "bun:test";
import { evaluate, fromConfig, merge, type Ruleset } from "@openoffice/core";

describe("permission evaluation", () => {
  test("allow rule permits tool", () => {
    const rules: Ruleset = [{ tool: "read", action: "allow" }];
    expect(evaluate("read", rules)).toBe("allow");
  });

  test("deny rule blocks tool", () => {
    const rules: Ruleset = [{ tool: "bash", action: "deny" }];
    expect(evaluate("bash", rules)).toBe("deny");
  });

  test("no matching rule defaults to allow", () => {
    const rules: Ruleset = [{ tool: "read", action: "allow" }];
    expect(evaluate("write", rules)).toBe("allow");
  });

  test("wildcard allow permits everything", () => {
    const rules: Ruleset = [{ tool: "*", action: "allow" }];
    expect(evaluate("bash", rules)).toBe("allow");
    expect(evaluate("read", rules)).toBe("allow");
  });

  test("wildcard deny blocks everything", () => {
    const rules: Ruleset = [{ tool: "*", action: "deny" }];
    expect(evaluate("bash", rules)).toBe("deny");
    expect(evaluate("read", rules)).toBe("deny");
  });

  test("later rules override earlier ones", () => {
    const rules: Ruleset = [
      { tool: "*", action: "deny" },
      { tool: "read", action: "allow" },
    ];
    expect(evaluate("read", rules)).toBe("allow");
    expect(evaluate("write", rules)).toBe("deny");
  });

  test("empty ruleset defaults to allow", () => {
    expect(evaluate("anything", [])).toBe("allow");
  });
});

describe("fromConfig", () => {
  test("converts tools array to permissions", () => {
    const perms = fromConfig(["read", "write", "glob"]);
    expect(evaluate("read", perms)).toBe("allow");
    expect(evaluate("write", perms)).toBe("allow");
    expect(evaluate("bash", perms)).toBe("deny");
  });

  test("empty tools array denies all", () => {
    const perms = fromConfig([]);
    expect(evaluate("read", perms)).toBe("deny");
  });

  test("undefined tools returns empty ruleset", () => {
    const perms = fromConfig(undefined);
    expect(evaluate("read", perms)).toBe("allow");
  });
});

describe("merge", () => {
  test("second ruleset overrides first", () => {
    const a: Ruleset = [{ tool: "*", action: "allow" }];
    const b: Ruleset = [{ tool: "bash", action: "deny" }];
    const merged = merge(a, b);
    expect(evaluate("read", merged)).toBe("allow");
    expect(evaluate("bash", merged)).toBe("deny");
  });

  test("empty second returns first", () => {
    const a: Ruleset = [{ tool: "read", action: "allow" }];
    const merged = merge(a, []);
    expect(evaluate("read", merged)).toBe("allow");
  });
});
