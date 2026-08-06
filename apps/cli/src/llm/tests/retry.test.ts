import { describe, expect, test } from "bun:test";
import { APICallError } from "ai";
import { classifyRetryable, retryDelay, streamWithRetry } from "../retry";

const apiError = (statusCode?: number, extra: Record<string, unknown> = {}) =>
  new APICallError({
    message: "boom",
    url: "https://example.com/v1",
    requestBodyValues: {},
    statusCode,
    ...extra,
  });

const fakeStream = (text: string) => ({
  textStream: (async function* () {
    yield text;
  })(),
  text: Promise.resolve(text),
  responseMessages: Promise.resolve([]),
  usage: Promise.resolve({ inputTokens: 1 }),
});

const noopSleep = async () => {};

describe("retryDelay", () => {
  test("exponential without headers, capped at 30s", () => {
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(2)).toBe(4000);
    expect(retryDelay(4)).toBe(16000);
    expect(retryDelay(5)).toBe(30000);
  });

  test("retry-after-ms wins when present", () => {
    expect(retryDelay(1, { "retry-after-ms": "1500" })).toBe(1500);
  });

  test("retry-after in seconds is converted to ms", () => {
    expect(retryDelay(1, { "retry-after": "5" })).toBe(5000);
  });

  test("retry-after as an HTTP date resolves to ms from now", () => {
    const future = new Date(Date.now() + 10_000).toUTCString();
    const delay = retryDelay(1, { "retry-after": future });
    expect(delay).toBeGreaterThan(9000);
    expect(delay).toBeLessThanOrEqual(10_000);
  });

  test("exponential with headers caps at the 32-bit setTimeout limit", () => {
    expect(retryDelay(22, {})).toBe(2_147_483_647);
  });
});

describe("classifyRetryable", () => {
  test("5xx is always retryable even when the SDK does not mark it", () => {
    expect(classifyRetryable(apiError(503)).retry).toBe(true);
  });

  test("429 marked retryable by the SDK is retried", () => {
    expect(classifyRetryable(apiError(429, { isRetryable: true })).retry).toBe(
      true
    );
  });

  test("4xx not marked retryable is not retried", () => {
    expect(classifyRetryable(apiError(400)).retry).toBe(false);
  });

  test("rate-limit text patterns are retried", () => {
    expect(classifyRetryable(new Error("Rate limit exceeded")).retry).toBe(
      true
    );
    expect(classifyRetryable(new Error("too many requests")).retry).toBe(true);
  });

  test("JSON error bodies are parsed for rate-limit codes", () => {
    expect(
      classifyRetryable(
        new Error(
          JSON.stringify({
            type: "error",
            error: { type: "too_many_requests" },
          })
        )
      ).retry
    ).toBe(true);
    expect(
      classifyRetryable(
        new Error(JSON.stringify({ code: "rate_limit_exceeded" }))
      ).retry
    ).toBe(true);
    expect(
      classifyRetryable(
        new Error(JSON.stringify({ code: "insufficient_quota" }))
      ).retry
    ).toBe(false);
  });

  test("unrelated errors are not retried", () => {
    expect(classifyRetryable(new Error("invalid model id")).retry).toBe(false);
  });
});

describe("streamWithRetry", () => {
  test("reruns from scratch on retryable failures, discarding partial output", async () => {
    let calls = 0;
    const retries: { attempt: number }[] = [];
    const create = () => {
      calls++;
      if (calls === 1) {
        return {
          textStream: (async function* () {
            yield "partial-";
            throw apiError(503);
          })(),
          // Never surfaced — the wrapper only reads these from the final attempt.
          text: Promise.resolve("partial"),
          responseMessages: Promise.resolve(["old"]),
          usage: Promise.resolve({ inputTokens: 0 }),
        };
      }
      return fakeStream("final");
    };

    const stream = streamWithRetry(create, {
      maxAttempts: 3,
      sleep: noopSleep,
      onRetry: (info) => retries.push(info),
    });

    let out = "";
    for await (const chunk of stream.textStream) out += chunk;

    // The wrapper cannot retract tokens already yielded by a failed attempt;
    // consumers discard them on onRetry (loop.ts resets its accumulator).
    expect(out).toBe("partial-final");
    expect(await stream.text).toBe("final");
    expect(await stream.responseMessages).toEqual([]);
    expect(await stream.usage).toEqual({ inputTokens: 1 });
    expect(retries).toHaveLength(1);
    expect(retries[0].attempt).toBe(1);
  });

  test("exhausting maxAttempts rethrows the original error", async () => {
    const create = () => {
      throw apiError(503);
    };
    const stream = streamWithRetry(create, {
      maxAttempts: 2,
      sleep: noopSleep,
      onRetry: () => {},
    });
    // Attach before iterating: the wrapper's `done` promise rejects when the
    // generator hits the terminal error, and bun flags late handlers.
    stream.text.catch(() => {});

    let thrown: unknown;
    try {
      for await (const _ of stream.textStream) {
        // not reached — create() always throws
      }
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(APICallError);
  });

  test("non-retryable errors fail immediately", async () => {
    let calls = 0;
    const create = () => {
      calls++;
      throw apiError(400);
    };
    let retries = 0;
    let thrown: unknown;
    try {
      streamWithRetry(create, {
        maxAttempts: 3,
        sleep: noopSleep,
        onRetry: () => retries++,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(APICallError);
    expect(calls).toBe(1);
    expect(retries).toBe(0);
  });

  test("config maxAttempts is honored via options", async () => {
    let calls = 0;
    const create = () => {
      calls++;
      throw apiError(503);
    };
    const stream = streamWithRetry(create, {
      maxAttempts: 3,
      sleep: noopSleep,
    });
    stream.text.catch(() => {});
    let thrown: unknown;
    try {
      for await (const _ of stream.textStream) {
        // not reached
      }
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(APICallError);
    expect(calls).toBe(3);
  });
});
