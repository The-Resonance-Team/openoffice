import { describe, expect, test } from "bun:test";
import { emit, on } from "../src/events";

describe("event bus", () => {
  test("emit delivers to subscribed listeners", () => {
    const received: unknown[] = [];
    on("session:create", (data) => received.push(data));
    emit("session:create", { sessionID: "s1" });
    expect(received).toEqual([{ sessionID: "s1" }]);
  });

  test("unsubscribe stops delivery", () => {
    let count = 0;
    const off = on("llm:token", () => {
      count++;
    });
    emit("llm:token", { sessionID: "s", token: "a" });
    off();
    emit("llm:token", { sessionID: "s", token: "b" });
    expect(count).toBe(1);
  });

  test("multiple listeners all receive", () => {
    let a = 0;
    let b = 0;
    on("session:end", () => {
      a++;
    });
    on("session:end", () => {
      b++;
    });
    emit("session:end", { sessionID: "s" });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  test("emit with no listeners is a no-op", () => {
    expect(() => emit("session:create", { sessionID: "s" })).not.toThrow();
  });

  test("unsubscribe is idempotent", () => {
    let count = 0;
    const off = on("tool:start", () => {
      count++;
    });
    off();
    off();
    emit("tool:start", { sessionID: "s", tool: "t", params: {} });
    expect(count).toBe(0);
  });
});
