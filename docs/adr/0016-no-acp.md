# 0016 — Not adopting ACP (Agent Client Protocol)

opencode implements ACP (`src/acp/`, `@agentclientprotocol/sdk`) — the protocol Zed and other ACP-aware editors use to drive an agent without custom integration work. `CONTEXT.md`'s Rules say to always reference opencode when building or improving features, so this is recorded explicitly: openoffice does not adopt it.

openoffice already has its own daemon/client protocol (issue #4, ADR 0007) — a deliberately simpler HTTP/SSE surface than ACP, built for openoffice's own clients (TUI, desktop). No ACP-aware office-document client exists to interoperate with; adopting ACP now would mean maintaining a second, heavier protocol surface for a consumer that doesn't exist. If an ACP-aware client for office documents shows up later, revisit — this is a "not yet," not a structural incompatibility.

## Considered options

- **Implement ACP alongside the existing daemon protocol**: rejected — real maintenance cost (a second protocol surface, kept in sync with the same session/tool/permission model) for zero current consumers.
