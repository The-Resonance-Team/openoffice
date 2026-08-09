# Agent System

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [officecli Skill](112-officecli-skill.md)
**Blocked by**: [Session Management](107-session-management.md), [Read-Only Tools](109-read-only-tools.md), [MCP Integration](110-mcp-integration.md)
**Assignee**: _(unclaimed)_

## Question

Define the agent system — which agents exist, what tools they have, what prompts they use.

### Agent definition

```ts
interface Agent {
  name: string
  description: string
  tools: string[]        // tool names this agent can use
  system: string         // system prompt
  model?: string         // override default model
}
```

### Built-in agents

**office** (default):
```ts
const officeAgent: Agent = {
  name: "office",
  description: "Office document assistant — create, read, and edit Word/Excel/PowerPoint files",
  tools: [
    "officecli",
    "read", "write", "glob", "grep",
    "question",
    "skill",
    // MCP tools are added dynamically
  ],
  system: `You are an office document assistant. You help users create, read, and edit
Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents using the officecli tool.

When editing documents, you work on a draft copy. The user will see a preview
of your changes and can accept or undo them.

You do NOT write code or use terminal commands. You work with document content directly.`,
}
```

**developer** (escape hatch):
```ts
const developerAgent: Agent = {
  name: "developer",
  description: "Full development agent with coding tools",
  tools: [
    "officecli",
    "read", "write", "glob", "grep",
    "question", "skill",
    "bash", "edit",  // coding tools
  ],
  system: `You are a development assistant with full coding capabilities.`,
}
```

### Agent registry

```ts
const agents = new Map<string, Agent>([
  ["office", officeAgent],
  ["developer", developerAgent],
])

export function getAgent(name: string): Agent | undefined {
  return agents.get(name)
}

export function getDefaultAgent(): Agent {
  return agents.get("office")!
}
```

### System prompt assembly

```ts
function getSystemPrompt(agent: Agent): string {
  return [
    agent.system,
    `Available tools: ${agent.tools.join(", ")}`,
    // Add skill content if skill tool is available
  ].join("\n\n")
}
```

### What NOT to build

- No agent permissions (v1: all tools in agent.tools are available)
- No dynamic agent generation (hardcoded agents for v1)
- No agent prompts from files (inline strings for v1)
- No agent modes (primary vs subagent — single mode for v1)

### Reference

- opencode agents: `packages/opencode/src/agent/agent.ts` (333 lines)
- opencode explore agent: lines 196-233 (permission pattern)
- opencode permission system: `packages/opencode/src/permission/` (3 files)
