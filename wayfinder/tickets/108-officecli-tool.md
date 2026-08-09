# officecli Tool

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Draft Lifecycle](113-draft-lifecycle.md)
**Blocked by**: [Tool System](106-tool-system.md)
**Assignee**: _(unclaimed)_

## Question

Implement the officecli tool — the core document manipulation tool that makes openoffice useful.

### Tool definition

```ts
import { z } from "zod/v4"

const officecliTool: ToolDefinition = {
  name: "officecli",
  description: "Create, read, and edit Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) documents",
  parameters: z.object({
    command: z.enum([
      "get", "set", "add", "remove", "replace", "batch",
      "list", "search", "screenshot", "view", "close", "create", "info"
    ]),
    file: z.string().describe("Path to the document"),
    path: z.string().optional().describe("DOM path (e.g., /body/p[@paraId=00100000])"),
    props: z.record(z.string(), z.any()).optional().describe("Properties to set"),
    operations: z.array(z.any()).optional().describe("Batch operations"),
    output: z.string().optional().describe("Output path for screenshots"),
    format: z.string().optional().describe("Output format (png, html)"),
    type: z.string().optional().describe("Element type for add commands"),
    query: z.string().optional().describe("Search query"),
    content: z.string().optional().describe("Content for replace commands"),
  }),
  execute: async (params) => {
    // 1. Check officecli installed
    // 2. Build command args
    // 3. Spawn officecli
    // 4. Parse --json output
    // 5. Return result
  }
}
```

### Implementation

```ts
import { execFileSync } from "child_process"

let installed: boolean | null = null

async function checkInstalled(): Promise<boolean> {
  if (installed !== null) return installed
  try {
    execFileSync("officecli", ["--version"], { timeout: 5000, stdio: "pipe" })
    installed = true
  } catch {
    installed = false
  }
  return installed
}

async function executeOfficeCli(params: OfficeCliParams): Promise<ToolResult> {
  if (!await checkInstalled()) {
    return { success: false, error: "officecli is not installed. Install: npm install -g officecli" }
  }
  
  const args = buildArgs(params)
  
  try {
    const output = execFileSync("officecli", args, {
      timeout: params.command === "batch" ? 60000 : 30000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    
    const parsed = JSON.parse(output)
    return { success: true, output: JSON.stringify(parsed), data: parsed }
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return { success: false, error: "officecli is not installed" }
    }
    // Parse error from stdout (officecli writes errors to stdout with --json)
    try {
      const error = JSON.parse(e.stdout)
      return { success: false, error: error.error.error, code: error.error.code }
    } catch {
      return { success: false, error: e.message }
    }
  }
}
```

### Mutating vs read-only

```ts
const MUTATING = new Set(["set", "add", "remove", "replace", "batch"])
function isMutating(command: string): boolean {
  return MUTATING.has(command)
}
```

This distinction drives the draft lifecycle (ticket 113).

### Registration

```ts
registry.register(officecliTool)
```

### Reference

- officecli skill: `~/.claude/skills/officecli/SKILL.md` (417 lines)
- Error shape research: `wayfinder/research/001-officecli-error-shape.md`
- opencode tool pattern: `packages/opencode/src/tool/tool.ts`
