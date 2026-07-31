# LLM Provider Abstraction

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Tool System](106-tool-system.md)
**Blocked by**: [Config System](103-config-system.md)
**Assignee**: _(unclaimed)_

## Question

Integrate Vercel AI SDK for LLM calls, supporting multiple providers (Anthropic, OpenAI, Google).

### Why Vercel AI SDK

- Standard TypeScript LLM abstraction
- Supports 20+ providers via `@ai-sdk/*` packages
- Streaming support built-in
- Tool use / function calling support
- Used by opencode, Cursor, and most TypeScript AI apps

### Implementation

```ts
import { generateText, streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"

const providers = { anthropic, openai, google }

function getProvider(model: string): { provider: any; modelName: string } {
  const [providerName, ...modelParts] = model.split("/")
  const provider = providers[providerName as keyof typeof providers]
  if (!provider) throw new Error(`Unknown provider: ${providerName}`)
  return { provider, modelName: modelParts.join("/") }
}

export async function chat(params: {
  model: string
  messages: Message[]
  tools?: ToolDefinition[]
  system?: string
}) {
  const { provider, modelName } = getProvider(params.model)
  
  return streamText({
    model: provider(modelName),
    messages: params.messages,
    tools: params.tools,
    system: params.system,
  })
}
```

### Dependencies

```bash
bun add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
```

### Provider config

From `openoffice.json`:
```json
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "provider": {
    "anthropic": { "apiKey": "env:ANTHROPIC_API_KEY" }
  }
}
```

API keys from environment variables or config file.

### What NOT to build

- No custom provider plugins (v1 uses direct SDK providers)
- No model catalog (user specifies model string directly)
- No cost tracking (add later if needed)
- No rate limiting (provider handles this)

### Reference

- Vercel AI SDK: `ai` package (v6.0.168 in opencode's catalog)
- opencode providers: `packages/llm/src/providers/` (13 provider files — massive)
- opencode uses all 20+ providers — we need 3 for v1
