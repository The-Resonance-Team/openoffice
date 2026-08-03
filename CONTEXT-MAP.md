# Context Map

## Contexts

- [OpenOffice](./CONTEXT.md) — the CLI/daemon: agents, tools, document engine, local sessions. Single-tenant, local-first.
- [Cloud](./cloud/CONTEXT.md) — hosted multi-tenant service: orgs, teams, roles, managed provider credentials, cloud-published skills, and usage analytics.

## Relationships

- **OpenOffice → Cloud**: the daemon's provider/config/skill resolution reaches out to Cloud as an optional layer beneath local config — local config always wins when both are present (see `cloud/docs/adr/`). The daemon works fully offline with no Cloud account at all.
- **Cloud → OpenOffice**: Cloud never reaches into the daemon directly; it only serves config/skills/credentials the daemon pulls, and receives the analytics events the daemon's event bus chooses to forward.

Reference source for building and improving features: `/Users/xirothedev/workspace/opencode`.

## Glossary / Context map → opencode source

| This repo's concept                        | opencode source path                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tool (ToolDefinition, ToolResult)          | `packages/opencode/src/tool/` (e.g. `read.ts`, `write.ts`, `glob.ts`, `grep.ts`, `question.ts`, `skill.ts`) |
| Skill system (loader, discovery, guidance) | `packages/core/src/skill.ts`, `packages/core/src/skill/discovery.ts`, `packages/core/src/skill/guidance.ts` |
| Tool registry / wiring                     | `packages/opencode/src/tool/` (registry patterns in `tool/index.ts`, tool implementations)                  |
| MCP server/client (McpManager, sdk-client) | `packages/opencode/src/mcp/` (`index.ts`, transports, `status()` pattern)                                   |

See `CONTEXT.md` → Rules → Reference source for the governing rule.
