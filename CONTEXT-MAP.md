# Context Map

Reference source for building and improving features: `/Users/xirothedev/workspace/opencode`.

## Glossary / Context map → opencode source

| This repo's concept                        | opencode source path                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tool (ToolDefinition, ToolResult)          | `packages/opencode/src/tool/` (e.g. `read.ts`, `write.ts`, `glob.ts`, `grep.ts`, `question.ts`, `skill.ts`) |
| Skill system (loader, discovery, guidance) | `packages/core/src/skill.ts`, `packages/core/src/skill/discovery.ts`, `packages/core/src/skill/guidance.ts` |
| Tool registry / wiring                     | `packages/opencode/src/tool/` (registry patterns in `tool/index.ts`, tool implementations)                  |
| MCP server/client (McpManager, sdk-client) | `packages/opencode/src/mcp/` (`index.ts`, transports, `status()` pattern)                                   |

See `CONTEXT.md` → Rules → Reference source for the governing rule.
