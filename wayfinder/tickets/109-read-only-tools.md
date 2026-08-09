# Read-Only Tools

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Agent System](111-agent-system.md)
**Blocked by**: [Tool System](106-tool-system.md)
**Assignee**: _(unclaimed)_

## Question

Implement basic read-only tools the agent needs alongside officecli.

### Tools to implement

**1. read** — read file contents

```ts
{
  name: "read",
  description: "Read the contents of a file",
  parameters: z.object({ path: z.string() }),
  execute: async ({ path }) => {
    const content = await fs.readFile(path, "utf-8")
    return { success: true, output: content }
  }
}
```

**2. write** — write file contents (for non-office files)

```ts
{
  name: "write",
  description: "Write content to a file",
  parameters: z.object({ path: z.string(), content: z.string() }),
  execute: async ({ path, content }) => {
    await fs.writeFile(path, content)
    return { success: true, output: `Wrote ${content.length} bytes to ${path}` }
  }
}
```

**3. glob** — find files by pattern

```ts
{
  name: "glob",
  description: "Find files matching a pattern",
  parameters: z.object({ pattern: z.string(), path: z.string().optional() }),
  execute: async ({ pattern, path: dir }) => {
    const files = await glob(pattern, { cwd: dir ?? process.cwd() })
    return { success: true, output: files.join("\n") }
  }
}
```

**4. grep** — search file contents

```ts
{
  name: "grep",
  description: "Search for patterns in file contents",
  parameters: z.object({ pattern: z.string(), path: z.string().optional() }),
  execute: async ({ pattern, path: dir }) => {
    const results = await execAsync(`rg "${pattern}" ${dir ?? "."}`)
    return { success: true, output: results }
  }
}
```

**5. question** — ask user a question

```ts
{
  name: "question",
  description: "Ask the user a question and wait for their response",
  parameters: z.object({ question: z.string() }),
  execute: async ({ question }) => {
    // Emit event, wait for response
    events.emit("question:ask", { question })
    const answer = await waitForResponse()
    return { success: true, output: answer }
  }
}
```

### What NOT to implement yet

- `bash`/`shell` — no terminal access in office mode
- `edit` — no code editing (use officecli for documents)
- `task`/`subagent` — no multi-agent orchestration
- `webfetch`/`websearch` — add later if needed

### Reference

- opencode tools: `packages/opencode/src/tool/` (read.ts, write.ts, glob.ts, grep.ts, question.ts)
- opencode core tools: `packages/core/src/tool/` (read.ts, write.ts, glob.ts, grep.ts)
