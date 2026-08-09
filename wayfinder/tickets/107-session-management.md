# Session Management

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Agent System](111-agent-system.md)
**Blocked by**: [Event System](104-event-system.md), [Tool System](106-tool-system.md)
**Assignee**: _(unclaimed)_

## Question

Implement session state — conversations, messages, and the agent loop.

### Session model

```ts
interface Session {
  id: string;
  agent: string; // "office" or "developer"
  model: string; // "anthropic/claude-sonnet-4-20250514"
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

interface ToolCall {
  id: string;
  name: string;
  params: any;
}

interface ToolResult {
  callId: string;
  result: any;
}
```

### Agent loop

```ts
import { streamText } from 'ai';

async function runTurn(session: Session, userMessage: string): Promise<void> {
  // Add user message
  session.messages.push({
    id: crypto.randomUUID(),
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });

  // Get available tools for this agent
  const tools = registry.list(); // filtered by agent later

  // Stream response
  const result = streamText({
    model: getModel(session.model),
    messages: session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    tools: tools.map(toAITool),
    system: getSystemPrompt(session.agent),
  });

  // Process tool calls
  for await (const chunk of result.textStream) {
    // Emit token events for streaming UI
    events.emit('llm:token', { sessionID: session.id, token: chunk });
  }

  // Collect final response
  const response = await result;
  session.messages.push({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: response.text,
    toolCalls: response.toolCalls,
    timestamp: Date.now(),
  });

  events.emit('session:message', { sessionID: session.id, message: session.messages.at(-1)! });
}
```

### Storage

v1: in-memory with JSON file persistence. No database yet.

```ts
const sessionsDir = path.join(config.dataDir, 'sessions');

async function saveSession(session: Session): Promise<void> {
  await fs.writeFile(
    path.join(sessionsDir, `${session.id}.json`),
    JSON.stringify(session, null, 2),
  );
}

async function loadSession(id: string): Promise<Session | null> {
  const file = path.join(sessionsDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(await fs.readFile(file, 'utf-8'));
}
```

### What NOT to build

- No SQLite database (JSON files until complexity demands DB)
- No compaction (context window management — add later)
- No message editing/deletion (append-only for v1)
- No multi-turn tool call loops (single turn per user message)

### Reference

- opencode sessions: `packages/core/src/session/` (20 files — massive)
- opencode session SQL: `packages/core/src/session/sql.ts`
- opencode processor: `packages/opencode/src/session/processor.ts` (tool call loop)
