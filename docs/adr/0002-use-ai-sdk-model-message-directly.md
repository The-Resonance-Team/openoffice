# 0002 — Use AI SDK's ModelMessage directly

The issue spec defined a custom `Message` interface with `toolCalls` and `toolResults` as separate fields. AI SDK's `ModelMessage` already handles this — tool calls are embedded in assistant messages as `content: [{ type: "tool-call" }]`, and tool results are `role: "tool"` messages with `content: [{ type: "tool-result" }]`. Using our own type means a mapping layer between our messages and what `streamText()` expects, for zero benefit. We use `ModelMessage` directly and track timestamps at the session level.
