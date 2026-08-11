# Event redaction by substring tree walk

Sensitive values (resolved `env:` config, stored Credentials, OAuth tokens) must never appear in events streamed to external clients via SSE. Redaction happens in the event bus `emit()` — every event type (`tool:start`, `tool:done`, `session:message`, etc.) is safe, no caller needs to remember.

The redaction set is a `Set<string>` of resolved `env:` values and stored Credentials with length >= 8 (short values like port numbers or booleans are excluded to avoid false positives). Captured once at config-load time. On each `emit()`, the event payload is walked: every string leaf is checked against the set, and if any known sensitive value appears as a substring, the entire containing string is replaced with `[redacted]`.

Alternatives considered: exact-match-only (misses secrets embedded in URLs or composite strings), regex pattern matching (catches common patterns but false positives on unrelated content), per-tool redaction (misses new tools, requires tool authors to remember), redaction only in `toAIToolsWithEvents` (misses `session:message` and other event types). The bus-level substring-tree-walk is the simplest approach that catches all secrets in all event types with negligible false-positive risk.
