import { APICallError } from 'ai';

// Retry policy mirrors opencode's (packages/opencode/src/session/retry.ts):
// exponential backoff 2s x 2^(attempt-1), Retry-After honored, retry only
// errors classified as retryable. opencode runs no jitter and neither do we.

const RETRY_INITIAL_DELAY = 2000;
const RETRY_BACKOFF_FACTOR = 2;
const RETRY_MAX_DELAY_NO_HEADERS = 30_000; // 30 seconds
const RETRY_MAX_DELAY = 2_147_483_647; // max 32-bit signed integer for setTimeout

export interface RetryInfo {
  attempt: number;
  message: string;
  next: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  onRetry?: (info: RetryInfo) => void;
  sleep?: (ms: number) => Promise<void>;
}

export type StreamLike = {
  textStream: AsyncIterable<string>;
  text: PromiseLike<string>;
  responseMessages: PromiseLike<unknown>;
  usage: PromiseLike<unknown>;
};

export interface RetryStream<T extends StreamLike> {
  textStream: AsyncIterable<string>;
  text: Promise<string>;
  responseMessages: Promise<Awaited<T['responseMessages']>>;
  usage: Promise<Awaited<T['usage']>>;
}

function cap(ms: number) {
  return Math.min(ms, RETRY_MAX_DELAY);
}

function headerNum(headers: Record<string, string> | undefined, name: string) {
  const value = headers?.[name];
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// Wait time for a given attempt. Honors Retry-After headers when the error
// carries response headers; otherwise plain exponential backoff.
export function retryDelay(attempt: number, headers?: Record<string, string>): number {
  if (headers) {
    const retryAfterMs = headerNum(headers, 'retry-after-ms');
    if (retryAfterMs !== undefined) return cap(retryAfterMs);

    const retryAfter = headers['retry-after'];
    if (retryAfter !== undefined) {
      const seconds = Number.parseFloat(retryAfter);
      if (!Number.isNaN(seconds)) return cap(Math.ceil(seconds * 1000));
      const parsed = Date.parse(retryAfter) - Date.now();
      if (!Number.isNaN(parsed) && parsed > 0) return cap(Math.ceil(parsed));
    }

    return cap(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1));
  }

  return cap(
    Math.min(
      RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1),
      RETRY_MAX_DELAY_NO_HEADERS,
    ),
  );
}

export interface Classification {
  retry: boolean;
  message: string;
  headers?: Record<string, string>;
}

// Retryable classification mirrors opencode's `retryable()`: SDK errors retry
// when the SDK marks them retryable or the status is 5xx; plain-text and JSON
// rate-limit patterns are retried. opencode's HTTP layer additionally absorbs
// transient network errors (we have no such layer), so network patterns are
// listed here too.
export function classifyRetryable(error: unknown): Classification {
  if (error instanceof APICallError) {
    const retry = error.isRetryable || (error.statusCode ?? 0) >= 500;
    return {
      retry,
      message: error.message,
      headers: error.responseHeaders,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const TEXT_PATTERNS = [
    'rate increased too quickly',
    'rate limit',
    'too many requests',
    'fetch failed',
    'socket hang up',
    'network error',
    'ecoconnrefused',
    'ecoconnreset',
  ];
  if (TEXT_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return { retry: true, message };
  }

  let json: unknown = null;
  try {
    json = JSON.parse(message);
  } catch {
    json = null;
  }
  if (json && typeof json === 'object') {
    const body = json as {
      type?: string;
      code?: string;
      error?: { type?: string; code?: string };
    };
    if (body.type === 'error' && body.error?.type === 'too_many_requests') {
      return { retry: true, message: 'Too Many Requests' };
    }
    const code = body.code ?? body.error?.code ?? '';
    if (code.includes('exhausted') || code.includes('unavailable')) {
      return { retry: true, message: 'Provider is overloaded' };
    }
    if (code.includes('rate_limit')) {
      return { retry: true, message: 'Rate Limited' };
    }
  }

  return { retry: false, message };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Re-runs the whole stream on retryable failures, mirroring opencode's
// Effect.retry around the full stream consumption: any retryable error —
// including mid-stream — restarts from scratch, and tokens already yielded
// by a failed attempt are re-yielded by the next. Consumers should discard
// the interrupted run (loop.ts resets its accumulator on onRetry).
export function streamWithRetry<T extends StreamLike>(
  create: () => T,
  options: RetryOptions = {},
): RetryStream<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;
  let settleDone: (result: T) => void;
  let settleFail: (error: unknown) => void;
  const done = new Promise<T>((resolve, reject) => {
    settleDone = resolve;
    settleFail = reject;
  });

  // create() runs eagerly so configuration errors (unknown provider, invalid
  // model string, missing credential) still throw synchronously from chat()/
  // complete(). Retryable create errors are deferred to the generator, which
  // waits the backoff and calls create() again.
  let first: { result: T } | { error: unknown } | null = null;
  try {
    first = { result: create() };
  } catch (error) {
    first = { error };
  }
  if (first && 'error' in first) {
    const classification = classifyRetryable(first.error);
    if (!classification.retry || maxAttempts <= 1) {
      throw first.error;
    }
  }

  async function* run(): AsyncGenerator<string> {
    for (;;) {
      attempt++;
      let result: T | null = null;
      let error: unknown = null;
      if (attempt === 1 && first) {
        if ('result' in first) result = first.result;
        else error = first.error;
      } else {
        try {
          result = create();
        } catch (caught) {
          error = caught;
        }
      }

      if (error !== null) {
        const classification = classifyRetryable(error);
        if (!classification.retry || attempt >= maxAttempts) {
          settleFail(error);
          throw error;
        }
        const wait = retryDelay(attempt, classification.headers);
        options.onRetry?.({
          attempt,
          message: classification.message,
          next: Date.now() + wait,
        });
        await sleep(wait);
        continue;
      }

      try {
        for await (const chunk of result!.textStream) yield chunk;
      } catch (error) {
        const classification = classifyRetryable(error);
        if (!classification.retry || attempt >= maxAttempts) {
          settleFail(error);
          throw error;
        }
        const wait = retryDelay(attempt, classification.headers);
        options.onRetry?.({
          attempt,
          message: classification.message,
          next: Date.now() + wait,
        });
        await sleep(wait);
        continue;
      }

      settleDone(result!);
      return;
    }
  }

  const textStream = run();
  // Consumers that only iterate textStream (loop.ts) still see the rejection
  // through the for-await throw; the sibling promises must not add unhandled
  // rejection noise on top. Awaiting them still rejects normally.
  const text = done.then((result) => result.text);
  const responseMessages = done.then((result) => result.responseMessages) as Promise<
    Awaited<T['responseMessages']>
  >;
  const usage = done.then((result) => result.usage) as Promise<Awaited<T['usage']>>;
  text.catch(() => {});
  responseMessages.catch(() => {});
  usage.catch(() => {});
  return { textStream, text, responseMessages, usage };
}
