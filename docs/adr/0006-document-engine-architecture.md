# 0006 — Document engine architecture

Issue #3 introduces the document engine: officecli tool, read-only tools, MCP integration, agent system, and officecli skill. The domain model grilling session resolved several architectural decisions.

## Permission-based tool access

Agents don't have a static `tools: string[]` list. Instead, each agent has a `permission: Permission.Ruleset` that controls which tools are accessible via allow/deny patterns. The `office` agent gets `permission: { "*": "allow", bash: "deny", edit: "deny" }`. The `developer` agent gets `permission: { "*": "allow" }`.

This replaces the issue's original `tools: ["officecli", "read", "write", "glob", "grep", "question", "skill"]` with a flexible permission system. Tool filtering happens at request time: the registry evaluates `Permission.evaluate(toolName, agentPermission)` for each tool.

## Skill is a bridge tool, not a capability flag

Skills are markdown content loaded on demand via a `skill` tool. The `skill` tool is a `ToolDefinition` registered in the tool registry — it takes `{ name: string }` and returns the SKILL.md content wrapped in `<skill_content>` tags.

The system prompt lists available skills as XML (`<available_skills>`), but full content is only loaded when the LLM calls `skill("officecli")`. This is lazy loading: the LLM sees skill names + descriptions, and loads full content only when needed.

The `skill` permission controls whether an agent can load skills. It is not a tool in the agent's tool list.

## Unified read tool with auto-detection

The `read` tool auto-detects file format and delegates to the appropriate backend:

- `.docx/.xlsx/.pptx` → officecli
- `.pdf` → pdf-parse
- `.txt/.md/.ts/.js` → plain text reader

This eliminates the routing problem: the LLM always reaches for `read` for any file. The `read` tool handles format detection internally. Write operations remain format-specific: `officecli` for Office documents, `write` for plain text.

## ToolResult strict shape

All tools normalize their output into a single `ToolResult` type:

```ts
type ToolResult =
  | { success: true; output: string; data?: unknown }
  | { success: false; error: string; code?: string };
```

The `output` field is human-readable text the LLM sees. The `data` field is optional structured data for programmatic consumers. Each tool's `execute` function is responsible for normalizing its internal output (e.g., officecli parses JSON, pdf-parse returns extracted text) into this shape.

## System prompt assembly

The system prompt is assembled in the session loop, not in the agent definition:

1. Agent's base system prompt (`agent.system`)
2. Environment context (model, working directory, date)
3. Available skills (XML list, if `skill` permission is allowed)
4. MCP server instructions (from connected servers)

The agent defines `system: "..."` as the base prompt. The session loop appends environment, skills, and MCP. This matches opencode's pattern: `Agent.Info` has `prompt`, and `SystemPrompt` service builds the rest.
