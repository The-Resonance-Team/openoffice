# Accept/Undo Routes

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Version History](116-version-history.md)
**Blocked by**: [Edit Preview](114-edit-preview.md)
**Assignee**: _(unclaimed)_

## Question

Implement accept and undo as HTTP routes for the UI to call.

### Routes

```
POST /api/sessions/:sessionID/accept
Body: { filePath: string }

POST /api/sessions/:sessionID/undo
Body: { filePath: string }
```

### Implementation

```ts
import { Hono } from "hono"

const app = new Hono()

app.post("/api/sessions/:sessionID/accept", async (c) => {
  const { sessionID } = c.req.param()
  const { filePath } = await c.req.json()
  
  const draftPath = getDraftPath(sessionID, filePath)
  const meta = getDraftMeta(draftPath)
  
  // 1. Flush
  execFileSync("officecli", ["close", draftPath], { timeout: 10000 })
  
  // 2. Copy draft to real file
  fs.copyFileSync(draftPath, meta.realFilePath)
  
  // 3. Record in version history
  recordAcceptPoint(sessionID, filePath)
  
  // 4. Cleanup
  fs.unlinkSync(draftPath)
  fs.unlinkSync(draftPath + ".meta.json")
  releaseLock(meta.filePathHash)
  
  return c.json({ success: true })
})

app.post("/api/sessions/:sessionID/undo", async (c) => {
  const { sessionID } = c.req.param()
  const { filePath } = await c.req.json()
  
  const draftPath = getDraftPath(sessionID, filePath)
  const meta = getDraftMeta(draftPath)
  
  // Discard draft — real file untouched
  fs.unlinkSync(draftPath)
  fs.unlinkSync(draftPath + ".meta.json")
  releaseLock(meta.filePathHash)
  
  return c.json({ success: true })
})
```

### HTTP framework

Use **Hono** — lightweight, fast, works in Node/Bun/Deno. Already in opencode's dependency tree.

```bash
bun add hono
```

### Why HTTP routes (not tool calls)

Per locked decision 11:
- Turn ends normally after tool call
- Preview sits in transcript until user clicks
- Model can't re-trigger or skip the decision

### Reference

- Hono: `hono@4.10.7` (in opencode's catalog)
- opencode revert routes: `packages/opencode/src/server/routes/instance/httpapi/groups/session.ts:369-392`
