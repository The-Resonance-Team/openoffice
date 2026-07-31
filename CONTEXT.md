# OpenOffice

A CLI that runs LLM agents equipped with tools to automate office document work.

## Language

**Agent**:
A named configuration bundle (description, allowed tools, model override) that becomes a live agent instance when a session starts. In v1, an Agent is a model string plus a system prompt — no permission system or sub-agent routing yet.
_Avoid_: assistant, chatbot

**Model**:
A string in `provider/model-id` format (e.g. `"anthropic/claude-sonnet-4-20250514"`). Resolved by splitting on `/` to find the provider SDK, then passing the model ID. Resolution order: the agent's model, then the top-level default, then the provider's default.
_Avoid_: LLM, model name

**Provider**:
An LLM service (openai, anthropic, google, ...) addressed by name. Each provider maps to an `@ai-sdk/*` npm package that implements the LanguageModelV1 interface. Provider credentials live in config via `env:` references.
_Avoid_: backend, service, backend provider

**Session**:
One conversation: a live agent instance, its message history, and the active model. Identified by a runtime-generated session ID. Persisted in a SQLite database via Drizzle ORM with `bun:sqlite` driver. Supports querying, compaction, and concurrent access from day one.
_Avoid_: chat, conversation, thread

**Message**:
A single turn in a session. Uses AI SDK's `ModelMessage` type directly — roles are `user`, `assistant`, `tool`, and `system`. Tool calls and results are embedded in the message content, not stored as separate fields.
_Avoid_: entry, record

**Tool**:
A callable unit exposed to the agent to perform an action. Defined with a Zod `inputSchema` and an `execute` function. Converted to AI SDK format via the `tool()` helper before passing to `streamText()`.
_Avoid_: action, function, plugin, capability

**ToolResult**:
The outcome of a tool execution. A discriminated union: `{ success: true, output: string }` or `{ success: false, error: string }`. Returned to the LLM as a `role: "tool"` message.
_Avoid_: response, output

**Office**:
The capability to produce Office documents (.docx/.xlsx/.pptx) from templates via the officecli subprocess.
_Avoid_: documents, doc generation

**Config**:
The project's typed configuration, loaded from layered sources (defaults, global, project) with environment overrides and `env:` references. API keys are stored as `env:VAR_NAME` strings resolved at load time.
_Avoid_: settings, options
