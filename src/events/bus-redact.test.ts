import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { on, emit, setSensitiveValues } from "./bus";

describe("bus redaction", () => {
  const original = sensitiveValuesBackup();

  beforeEach(() => {
    setSensitiveValues(new Set(["sk-abc123xyz"]));
  });

  afterEach(() => {
    setSensitiveValues(original);
  });

  test("tool:start event redacts sensitive params", () => {
    let received: any;
    const off = on("tool:start", (d) => {
      received = d;
    });
    emit("tool:start", {
      sessionID: "s1",
      tool: "read",
      params: { path: "key=sk-abc123xyz" },
    });
    off();
    expect(received.params.path).toBe("[redacted]");
  });

  test("tool:done event redacts sensitive result", () => {
    let received: any;
    const off = on("tool:done", (d) => {
      received = d;
    });
    emit("tool:done", {
      sessionID: "s1",
      tool: "read",
      result: { success: true, output: "sk-abc123xyz" },
    });
    off();
    expect(received.result.output).toBe("[redacted]");
  });

  test("session:message event redacts sensitive content", () => {
    let received: any;
    const off = on("session:message", (d) => {
      received = d;
    });
    emit("session:message", {
      sessionID: "s1",
      role: "assistant",
      content: "the key is sk-abc123xyz",
    });
    off();
    expect(received.content).toBe("[redacted]");
  });

  test("events without secrets pass through unchanged", () => {
    let received: any;
    const off = on("tool:start", (d) => {
      received = d;
    });
    emit("tool:start", {
      sessionID: "s1",
      tool: "read",
      params: { path: "/safe/file.txt" },
    });
    off();
    expect(received.params.path).toBe("/safe/file.txt");
  });
});

function sensitiveValuesBackup(): Set<string> {
  // Capture the current module state by emitting a dummy and seeing if it's redacted
  // Since we can't read the module variable directly, we test via behavior
  // In the afterEach we just reset to empty
  return new Set<string>();
}
