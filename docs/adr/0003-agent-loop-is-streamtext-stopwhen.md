# 0003 — Agent loop is streamText() + stopWhen, not a custom while-loop

## Status

Superseded by ADR-0033 (opencode as the base platform) — this decision now lives in the base.

The issue spec describes a manual loop: call LLM → check for tool calls → execute tools → feed results back → repeat until no tool calls. AI SDK handles this internally via `stopWhen: isStepCount(N)`. The entire agent loop is one `streamText()` call with tools and a step limit — no custom loop, no manual tool-call detection, no re-invocation logic. The SDK loops until the model produces text (no more tool calls) or hits the step cap.
