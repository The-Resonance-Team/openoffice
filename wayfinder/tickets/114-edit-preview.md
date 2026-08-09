# Edit Preview

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Accept/Undo Routes](115-accept-undo.md)
**Blocked by**: [Draft Lifecycle](113-draft-lifecycle.md)
**Assignee**: _(unclaimed)_

## Question

Render before/after screenshots of document edits for user review.

### Implementation

After a mutating officecli command completes:

```ts
async function generatePreview(sessionID: string, filePath: string, draftPath: string) {
  // Flush draft to disk
  execFileSync("officecli", ["close", draftPath], { timeout: 10000 })
  
  // Screenshot "after" (draft)
  const afterPng = path.join(dataDir, "preview", sessionID, `${simpleHash(filePath)}-after.png`)
  execFileSync("officecli", ["view", draftPath, "screenshot", "-o", afterPng], { timeout: 30000 })
  
  // Screenshot "before" (real file — untouched)
  const beforePng = path.join(dataDir, "preview", sessionID, `${simpleHash(filePath)}-before.png`)
  execFileSync("officecli", ["view", filePath, "screenshot", "-o", beforePng], { timeout: 30000 })
  
  return { before: beforePng, after: afterPng }
}
```

### Tool output

Include preview in tool result:

```ts
{
  success: true,
  output: "Added paragraph at /body/p[@paraId=00100000]",
  preview: { before: beforePng, after: afterPng, file: filePath }
}
```

### Why PNG

No HTML/webview renderer needed. PNG works everywhere — TUI, web, desktop.

### Reference

- officecli view command: `~/.claude/skills/officecli/SKILL.md`
- opencode FileMedia: `packages/session-ui/src/components/file-media.tsx`
