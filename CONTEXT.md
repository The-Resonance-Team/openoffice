# OpenOffice

A CLI that runs LLM agents equipped with tools to automate office document work.

## Rules

**Reference source**: When building or improving features, always reference the opencode source at `/Users/xirothedev/workspace/opencode`.

**Dogfooding**: A configured MCP server whose name matches a native tool is never connected — the native integration (typed verbs, install check, chaining) is strictly better than the MCP `command`-string surface. Native wins.

**Event safety**: Events emitted within the daemon (`tool:start`, `tool:done`, etc.) may be streamed to external clients via SSE. Sensitive values are redacted in the event bus `emit()` — every event type is safe, no caller needs to remember. The bus is the single choke point.

**Error messages**: Error messages returned to clients may reference env var _names_ (e.g. "set `GITHUB_TOKEN`") but never their _resolved values_. Applies to config resolution errors, provider auth errors, and any caught exception whose message might include config data.

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
One conversation: a live agent instance, its message history, and the active model. Identified by a runtime-generated session ID. Persisted in a SQLite database via Drizzle ORM with `bun:sqlite` driver. Supports querying and concurrent access from day one. Compaction (pruning old tool outputs, then summarizing older turns to stay under the context window) runs at the top of each turn when the last persisted token usage exceeds the model's usable window, sized from models.dev. Owned by #17. Ends via an explicit client call or, once its heartbeat goes stale, a background sweep — never merely on a client's connection dropping. Owned by #39.
_Avoid_: chat, conversation, thread

**Message**:
A single turn in a session. Uses AI SDK's `ModelMessage` type directly — roles are `user`, `assistant`, `tool`, and `system`. Tool calls and results are embedded in the message content, not stored as separate fields. A user message may include attached images as content parts (resized/compressed before send — owned by #26), not just text.
_Avoid_: entry, record

**Todo**:
A structured task-list item the agent maintains during a session (`content`, `status`, `priority`), written wholesale via a `todo` tool call — not merged incrementally. Exactly one `in_progress` at a time. Session-scoped, independent of message-history compaction. Owned by #39.
_Avoid_: task, checklist item

**Job**:
A turn running detached from any connected client — started, then polled or cancelled rather than streamed to a blocking caller. Not a separate entity from Session: a Job is "this session's turn, running server-side, independent of whether a client is still attached." Owned by #25.
_Avoid_: task, background task, worker

**Tool**:
A callable unit exposed to the agent to perform an action. Defined with a Zod `inputSchema` and an `execute` function. Converted to AI SDK format via the `tool()` helper before passing to `streamText()`. Tools can reference other tools for chaining (e.g., a document reader delegates to pdf-inspector (PDF) or anydoc (other formats) based on file extension). MCP tools are the exception: they carry their server's JSON Schema (not Zod) and the AI SDK accepts it directly.
_Avoid_: action, function, plugin, capability

**MCP server**:
A Model Context Protocol server configured in `config.mcp` as `local` (stdio command) or `remote` (streamable HTTP URL). Connected at startup via `@modelcontextprotocol/sdk`; its tools are exposed namespaced as `{serverName}_{toolName}` with the server's input schema passed through to the AI SDK. A server whose name matches a native tool is skipped (see Rules → Dogfooding).
_Avoid_: plugin, backend server

**ToolResult**:
The outcome of a tool execution. A strict discriminated union: `{ success: true, output: string, data?: unknown }` or `{ success: false, error: string, code?: string }`. The `output` field is human-readable text the LLM sees. The `data` field is optional structured data for programmatic consumers (session loop, draft lifecycle). Each tool normalizes its internal output into this shape.
_Avoid_: response, output

**Skill**:
Markdown content (.md file with frontmatter) that teaches the LLM how to use a specific tool or domain. Loaded on demand via the `skill` tool — listed in the system prompt as available skills, but full content is only injected when the LLM calls `skill("name")`. Skills are prompt content, not executable code.
_Avoid_: instructions, guide, documentation

**Command**:
A named, reusable prompt template (`$ARGUMENTS` substituted, optional agent/model override) dispatched by the user typing `/name args`. Distinct from a Skill (teaches the LLM how to use something, loaded lazily by the LLM itself) and a Tool (a callable action) — a Command is the user invoking a canned instruction, resolved before the LLM ever sees the turn. Owned by #24.
_Avoid_: slash command (fine casually, but "Command" is the canonical term in code), macro, template

**Permission**:
An agent-level ruleset controlling which tools are accessible. Uses allow/deny patterns per tool name. Replaces a static `tools: string[]` list with a flexible permission system. The `skill` capability is a permission, not a tool — it controls whether the agent can load skills.
_Avoid*: access control, tool list, capability

**Document toolkit**:
The collection of tools available for document manipulation: officecli (OOXML editing), pdf-inspector (PDF reading via napi-rs — classifyPdf detects TextBased/Scanned/ImageBased/Mixed; TextBased → full Markdown with tables/structure, Scanned/ImageBased → honest error, Mixed/encoding → partial extraction with warning; replaces anydoc for PDFs), anydoc (docx/xlsx/pptx to Markdown — retained for non-PDF formats), oocr (OCR fallback for scanned/image-based PDFs and standalone images via local Tesseract — auto-triggered by `read` when pdf-inspector returns PDF_NO_TEXT_LAYER), pandoc (format conversion). Each tool has its own `ToolDefinition` and can reference other tools for chaining. The `read` tool auto-detects file format and delegates to the appropriate backend.
_Avoid_: Office, document tools, doc tools

**Config**:
The project's typed configuration, loaded from layered sources (defaults, global, project) with environment overrides and `env:` references. API keys are stored as `env:VAR_NAME` strings resolved at load time.
_Avoid_: settings, options

**Credential**:
A provider's stored authentication material — OAuth access/refresh tokens or a plain API key — obtained via `openoffice auth login` and persisted locally. Resolution order: an explicit config `env:` reference always wins; a stored Credential is used only when config supplies no value; with neither, the user gets a clear error naming the provider. Never logged and never printed by `auth list`.
_Avoid_: key, token, secret

**Sensitive value**:
Any data that must not appear in events streamed to external consumers — resolved `env:` config values, stored Credentials, OAuth tokens, and anything matching common API-key patterns. Redacted by the event bus `emit()`: walks every string leaf in the event payload, and if any known sensitive value (length >= 8) appears as a substring, the entire containing string is replaced with `[redacted]`. The set of known sensitive values is captured at config-load time from all resolved `env:` values and stored Credentials.
_Avoid_: secret, confidential data

### Daemon & clients

**Daemon**:
The long-running background process (`openoffice serve`) that hosts the session loop, tools, and the HTTP/SSE API. Auto-spawned detached by the CLI if none is running for the current user. Binds loopback-only (`127.0.0.1`) in v1. All agent work happens in the daemon, never in a client.
_Avoid_: server (ambiguous with the HTTP framework), backend

**Daemon auth**:
HTTP Basic auth on every daemon route, configured by the `OPENOFFICE_SERVER_PASSWORD` env var (username via `OPENOFFICE_SERVER_USERNAME`, default `openoffice`). Optional: no password set means no auth required — loopback binding is the real boundary until Sync (widening the bind beyond loopback) makes the password mandatory. Mirrors opencode's `OPENCODE_SERVER_PASSWORD` design. Distinct from Credentials (gate provider access) and Share tokens (read-only session access via URL).
_Avoid_: auth token, access token, session token

**Client**:
A thin process that connects to the daemon over HTTP/SSE instead of running the agent loop itself — the TUI and, later, the desktop app. Sends commands via HTTP routes, receives token/event streams via SSE.
_Avoid_: UI, frontend, app

**Share**:
A revocable, unguessable-token URL giving a non-participant read-only access to a session's transcript and edit previews over SSE. Cannot reach accept/undo/revert — those require an authenticated daemon client, not a share token. Not collaboration: single accepting user, others only watch. Lives as long as its session — revoked by unshare or session end; unknown and revoked tokens are indistinguishable (`410`).
_Avoid_: collaboration, multi-user, link

**Sync**:
A second device (the same user's) reaching the same daemon as a full client — same token as any other client, not a separate identity. Requires widening the daemon's bind beyond loopback; the token becomes the only boundary once that happens. Not per-device pairing, not concurrent editing.
_Avoid_: collaboration, multi-user, replication
_Distinct from_: Cloud Config (`cloud/CONTEXT.md`) — an Org distributing provider/skill config to a member's daemon. That's config distribution to possibly-many devices belonging to possibly-many people; Sync is one person's second device joining one daemon.

### Draft lifecycle

**Draft**:
A working copy of a document that the agent edits; the real file is untouched until accept. Keyed by the real file's path hash, not by session, so any session can discover a file's drafts: `drafts/{filePathHash}/{sessionID}.{ext}`. A draft may exist without a real file — new documents (officecli `create`, convert) are born as drafts and Accept creates the real file. New drafts with no real file have no "before" preview.
_Avoid_: copy, working file, temp file

**Lock**:
A per-file claim (keyed by `filePathHash`) granting one session the right to hold an active draft for that file. Touched by every mutating command; stale (>24h since the last touch) locks can be overridden by another session. Released only on Accept, Undo, or stale override — never on client disconnect, because sessions persist beyond their clients. A session whose lock was overridden gets a clear error on its next mutating command; the agent re-reads the file and the orphan scan surfaces the abandoned draft for accept or discard.
_Avoid_: mutex, session lock

**Orphaned draft**:
A draft whose session lost its lock (stale override) or ended without accept or discard. Discoverable by the file-keyed orphan scan (`drafts/{filePathHash}/*`) when the file is opened from any session, and resolvable only through the accept-or-discard prompt — never deleted silently.
_Avoid_: abandoned draft, lost edits

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

**Snapshot**:
A recorded copy of a file's state at an Accept-point, stored in that file's version history. The source Revert restores from and the "before" in previews.
_Avoid_: copy, backup, old version

**Version history**:
A file's ordered list of Accept-points, keyed by the real file's path hash so any session can look it up or revert without knowing which session accepted last.
_Avoid_: history (bare), changelog

### Release & update

**Release**:
A tagged distribution of openoffice: a semver tag (`vX.Y.Z`, optionally a pre-release like `v0.2.0-rc.1`), a GitHub Release carrying the platform artifacts, and the npm package — all cut from the same tag by the build pipeline. The only thing a client can install or Update to.
_Avoid_: build, tag, publish, version

**Artifact**:
A platform-specific distribution unit attached to a Release: a compiled CLI binary (`openoffice-{os}-{arch}`, e.g. `openoffice-win32-x64.exe`) or a desktop installer. Everything a Release attaches is an Artifact.
_Avoid_: binary, build output, bundle

**Update**:
Replacing an installed openoffice with a newer Release — the daemon checks GitHub Releases periodically (cached result), and the CLI `update` command forces a fresh check, verifies the downloaded Artifact's checksum, and swaps the binary in, keeping the previous one until the next run succeeds. Both stable and pre-release Releases are offered; whichever tag is newest by semver wins. Gated by config (`update.check`).
_Avoid_: upgrade, auto-update (fine casually), self-update
