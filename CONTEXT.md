# OpenOffice

A CLI that runs LLM agents equipped with tools to automate office document work.

## Language

**Agent**:
A named configuration bundle (description, permissions, model override) that becomes a live agent instance when a session starts. In v1, an Agent is a model string, a system prompt, and a permission ruleset that controls which tools are accessible.
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
A callable unit exposed to the agent to perform an action. Defined with a Zod `inputSchema` and an `execute` function. Converted to AI SDK format via the `tool()` helper before passing to `streamText()`. Tools can reference other tools for chaining (e.g., a document reader delegates to officecli or pdf-parse based on file extension).
_Avoid_: action, function, plugin, capability

**ToolResult**:
The outcome of a tool execution. A strict discriminated union: `{ success: true, output: string, data?: unknown }` or `{ success: false, error: string, code?: string }`. The `output` field is human-readable text the LLM sees. The `data` field is optional structured data for programmatic consumers (session loop, draft lifecycle). Each tool normalizes its internal output into this shape.
_Avoid_: response, output

**Skill**:
Markdown content (.md file with frontmatter) that teaches the LLM how to use a specific tool or domain. Loaded on demand via the `skill` tool — listed in the system prompt as available skills, but full content is only injected when the LLM calls `skill("name")`. Skills are prompt content, not executable code.
_Avoid_: instructions, guide, documentation

**Permission**:
An agent-level ruleset controlling which tools are accessible. Uses allow/deny patterns per tool name. Replaces a static `tools: string[]` list with a flexible permission system. The `skill` capability is a permission, not a tool — it controls whether the agent can load skills.
_Avoid*: access control, tool list, capability

**Document toolkit**:
The collection of tools available for document manipulation: officecli (OOXML editing), pdf-parse (PDF reading), oocr (text extraction), pandoc (format conversion). Each tool has its own `ToolDefinition` and can reference other tools for chaining. The `read` tool auto-detects file format and delegates to the appropriate backend.
_Avoid_: Office, document tools, doc tools

**Config**:
The project's typed configuration, loaded from layered sources (defaults, global, project) with environment overrides and `env:` references. API keys are stored as `env:VAR_NAME` strings resolved at load time.
_Avoid_: settings, options
