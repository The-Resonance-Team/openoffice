# 0024 — LLM resilience: opencode's retry policy, no provider fallback, expanded providers

## Status

Superseded by ADR-0033 (opencode as the base platform) — this decision now lives in the base.

Issue #13 asked for retry/backoff, provider fallback, and five new providers. Grilling settled the shape: **no provider fallback** — the session model stays a single `provider/model-id` string (the glossary's `Model` definition survives untouched, and the DB's single `text NOT NULL` model column needs no schema change) — and the retry policy is ported from opencode's reference implementation (`packages/opencode/src/session/retry.ts`, applied around the whole stream consumption at `processor.ts:660`).

## Retry policy

- **Scope**: the retry wrapper owns the entire stream consumption, mirroring opencode's `Effect.retry` around the full stream. Any retryable failure — including mid-stream after partial tokens — re-runs the turn from scratch. Tokens already emitted by a failed attempt cannot be retracted; `loop.ts` discards them by resetting its accumulator in the `onRetry` callback, and clients learn about the interruption via the new `llm:retry` event (`{ sessionID, attempt, message, next }`, mirroring opencode's status shape).
- **Classification** (`classifyRetryable`): SDK `APICallError` retries when the SDK marks it retryable _or_ the status is ≥ 500; plain-text rate-limit patterns ("rate limit", "too many requests", "rate increased too quickly") and JSON error bodies (`too_many_requests`, `exhausted`/`unavailable`, `rate_limit`) retry; everything else (401/400, invalid model, context overflow) fails immediately. opencode additionally absorbs transient network errors in an HTTP-client layer we don't have, so "fetch failed" / "socket hang up" / connection-refused patterns are classified retryable here.
- **Delay** (`retryDelay`): `retry-after-ms`, then `retry-after` (seconds or HTTP date), else `2000ms × 2^(attempt-1)` — capped at 30s without headers, 2³¹−1 ms with. No jitter, exactly like opencode's LLM policy (jitter exists only in their separate HTTP-client retry layer, which does not apply to us).
- **Attempt cap**: `llm.retry.max`, default 3 — opencode is unbounded, but an unbounded doubling retry is a bad default for a CLI turn; the cap is the one deliberate deviation.

## Provider expansion

`providers.ts` gains `ollama` (`ollama-ai-provider`, no key, base URL default `http://localhost:11434`), `openrouter` (no official SDK package — it _is_ an OpenAI-compatible endpoint, so `createOpenAI` with default `https://openrouter.ai/api/v1`), `azure` (`@ai-sdk/azure`, resource endpoint via `baseURL`, deployment name as the model ID), `bedrock` (`@ai-sdk/amazon-bedrock`, AWS credential chain, `region` optional in config). Ollama and bedrock skip the credential-resolution path entirely — ollama runs unauthenticated, bedrock authenticates via AWS. Custom endpoints: any provider config with `baseURL` + `compatibility: "openai" | "anthropic"` becomes a provider under its config name, resolving through `createOpenAI`/`createAnthropic` with that base URL; a custom provider without a `baseURL` errors clearly.

`openoffice models` probes the three common local endpoints (Ollama `:11434/api/tags`, llama.cpp `:8080/v1/models`, vLLM `:8000/v1/models`) with a 1s timeout, silently skipping unreachable ones. The output is informational: llama.cpp/vLLM model strings embed `provider/model-id` refs and aren't directly usable as config `model:` values without a custom-endpoint provider.

## Considered options

- **Provider fallback lists (`model: ["a", "b"]`)**: rejected — the DB and glossary both model a single session model; fallback adds an "active model" runtime fact, per-message model recording changes, and a client-facing "switched providers" surface, for a failure mode (primary provider down for a whole turn) that retries already cover. Retry-only keeps the domain model untouched.
- **Jittered backoff**: rejected — opencode's LLM policy runs none, and Retry-After already handles shared-burst timing.
- **Unbounded retries (opencode's exact behavior)**: rejected — with a 2s-doubling schedule this is effectively "hang until success"; `llm.retry.max` (default 3) is a deliberate, configurable cap.
- **Startup auto-detection probe**: rejected — latency and noise on every session start to populate a model picker that doesn't exist; a `models` command surfaces the same information on demand.
- **`@ai-sdk/ollama` package**: doesn't exist on npm; the Vercel-documented `ollama-ai-provider` package is used instead.
