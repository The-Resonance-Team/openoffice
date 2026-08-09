# Config System

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Event System](104-event-system.md), [LLM Provider Abstraction](105-llm-providers.md)
**Blocked by**: [Package Structure](102-package-structure.md)
**Assignee**: _(unclaimed)_

## Question

Implement configuration loading — where config lives, how it merges, what it contains.

### Config file

Single config file: `openoffice.json` (or `openoffice.jsonc`) at project root.

```jsonc
{
  // LLM provider config
  "provider": {
    "anthropic": { "apiKey": "env:ANTHROPIC_API_KEY" },
    "openai": { "apiKey": "env:OPENAI_API_KEY" }
  },
  
  // Default model
  "model": "anthropic/claude-sonnet-4-20250514",
  
  // Agent definitions
  "agent": {
    "office": {
      "description": "Office document assistant",
      "tools": ["officecli", "read", "skill"]
    }
  },
  
  // MCP servers
  "mcp": {},
  
  // Office-specific
  "office": {
    "managedDocumentsFolder": "~/Documents/OpenOffice"
  }
}
```

### Config loading order (merge, later wins)

1. Built-in defaults
2. Global config: `~/.config/openoffice/config.json`
3. Project config: `./openoffice.json` (walk up to root)
4. Environment variables: `OPENOFFICE_*`

### Implementation

```ts
import { z } from "zod/v4"

const ConfigSchema = z.object({
  model: z.string().optional(),
  provider: z.record(z.string(), z.object({ apiKey: z.string() })).optional(),
  agent: z.record(z.string(), z.object({
    description: z.string().optional(),
    tools: z.array(z.string()).optional(),
    model: z.string().optional(),
  })).optional(),
  mcp: z.record(z.string(), z.object({
    type: z.enum(["local", "remote"]),
    command: z.array(z.string()).optional(),
    url: z.string().optional(),
  })).optional(),
  office: z.object({
    managedDocumentsFolder: z.string().optional(),
  }).optional(),
})

type Config = z.infer<typeof ConfigSchema>
```

Use Zod v4 for validation (already in opencode's dependency tree).

### Reference

- opencode config: `packages/opencode/src/config/config.ts` (681 lines — way too complex for v1)
- opencode schema: `packages/core/src/config.ts` (227 lines)
- Zod v4: `zod@4.1.8` (in opencode's catalog)
