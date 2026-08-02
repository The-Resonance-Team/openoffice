# OpenOffice

A CLI that runs LLM agents equipped with tools to automate office document work.

## Rules

**Reference source**: When building or improving features, always reference the opencode source at `/Users/xirothedev/workspace/opencode`.

## Language

**Agent**:
A named configuration bundle (description, permissions, model override) that becomes a live agent instance when a session starts. In v1, an Agent is a model string, a system prompt, and a permission ruleset that controls which tools are accessible.
_Avoid_: assistant, chatbot

**Model**:
A string in `provider/model-id` format (e.g. `"anthropic/claude-sonnet-4-20250514"`). Resolved by splitting on `/` to find the provider SDK, then passing the model ID. Resolution order: the agent's model, then the top-level default, then the provider's default.
_Avoid_: LLM, model name

**Provider**:
An LLM service (openai, anthropic, google, ollama, openrouter, ...) addressed by name, or a custom OpenAI/Anthropic-compatible endpoint given a `baseURL`. Each named provider maps to an `@ai-sdk/*` npm package that implements the LanguageModelV1 interface. Credentials come from config `env:` references (priority) or a stored login from `openoffice auth login` — never both silently; `env:` always wins.
_Avoid_: backend, service, backend provider

**Session**:
One conversation: a live agent instance, its message history, and the active model. Identified by a runtime-generated session ID. Persisted in a SQLite database via Drizzle ORM with `bun:sqlite` driver. Supports querying and concurrent access from day one. Compaction (pruning old tool outputs, then summarizing older turns to stay under the context window) is deferred — not yet built, owned by #17.
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

### Daemon & clients

**Daemon**:
The long-running background process (`openoffice serve`) that hosts the session loop, tools, and the HTTP/SSE API. Auto-spawned detached by the CLI if none is running for the current user. All agent work happens in the daemon, never in a client.
_Avoid_: server (ambiguous with the HTTP framework), backend

**Client**:
A thin process that connects to the daemon over HTTP/SSE instead of running the agent loop itself — the TUI and, later, the desktop app. Sends commands via HTTP routes, receives token/event streams via SSE.
_Avoid_: UI, frontend, app

**Share**:
A revocable, unguessable-token URL giving a non-participant read-only access to a session's transcript and edit previews over SSE. Cannot reach accept/undo/revert — those require the daemon's own client token, not a share token. Not collaboration: single accepting user, others only watch.
_Avoid_: collaboration, multi-user, link

### Draft lifecycle

**Draft**:
A working copy of a document that the agent edits; the real file is untouched until accept. Keyed by the real file's path hash, not by session, so any session can discover a file's drafts: `drafts/{filePathHash}/{sessionID}.{ext}`.
_Avoid_: copy, working file, temp file

**Lock**:
A per-file claim (keyed by `filePathHash`) granting one session the right to hold an active draft for that file. Stale locks (>24h untouched) can be overridden by another session.
_Avoid_: mutex, session lock

**Accept**:
The only operation that writes to the real file. Flushes the draft, copies it over the real file, records an accept-point in that file's version history, and releases the draft and lock.
_Avoid_: save, commit, apply

**Undo**:
Discards the current draft before accept. The real file was never touched, so there is nothing to revert. Distinct from Revert, which acts on an already-accepted file.
_Avoid_: discard, cancel

**Revert**:
Restores a file to a previously accepted state. Creates a new draft from the recorded snapshot and routes it through the normal Accept flow — never writes the real file directly. The real file has exactly one write path: Accept.
_Avoid_: rollback, restore

**Accept-point**:
A recorded entry in a file's version history: timestamp, snapshot, and which session made it. Keyed by `filePathHash` (`history/{filePathHash}.json`), so any session can look up or revert a file's history without knowing which session last accepted it.
_Avoid_: version, checkpoint

**Preview**:
A before/after screenshot comparison shown after a mutating edit. Before is always the untouched real file; after is the draft's current state. Comparisons are cumulative since the last accept, not incremental per edit.
_Avoid_: diff, comparison
