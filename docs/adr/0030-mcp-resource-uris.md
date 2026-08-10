# `mcp://` resource references carry percent-encoded URIs

Resources from MCP servers are addressable in the `read` tool as `mcp://{serverName}/{encodeURIComponent(resourceUri)}`. The host is the configured server name; the path is the resource's own URI (which may itself carry a scheme and slashes) percent-encoded so the reference splits unambiguously at the first `/` (parsed from the raw string, not the `URL` class — URL lowercases the host, and server names are case-sensitive). This is the agent-facing reference convention — changing it later breaks references already recorded in session history, and the encoding is why.

Considered options: percent-encoded path (chosen); raw URI path (`mcp://files/file:/tmp/x.pdf` — ambiguous split, rejected); a structured `{clientName, uri}` tool parameter (not a single URI-shaped string the agent can copy, rejected).
