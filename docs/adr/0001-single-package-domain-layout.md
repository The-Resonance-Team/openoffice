# 0001 — Single package with domain-based directories

OpenOffice is a single Bun package with flat, domain-based directories under `src/` (`config/`, `llm/`, `tool/`, `agent/`, `session/`, `mcp/`, `office/`, `events/`), not a monorepo. We chose this because the domains share config types, event types, and session state, so package boundaries would add overhead without adding ownership or deployment value — splitting into packages later is a mechanical migration we can do when the codebase actually needs it.
