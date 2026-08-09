# Draft Lifecycle

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)

- [Edit Preview](114-edit-preview.md)
  **Blocked by**: [officecli Tool](108-officecli-tool.md), [officecli Skill](112-officecli-skill.md)
  **Assignee**: _(unclaimed)_

## Question

Implement the draft lifecycle — the mechanism that makes auto-approve safe.

### Core concept

When the agent edits a document, it edits a **draft copy**, not the real file. The user sees a preview and decides to accept or undo. The real file is never touched by tool calls.

### Draft path

```
~/.local/share/openoffice/drafts/{sessionID}/{filePathHash}.{ext}
```

### Draft creation

Before any mutating officecli command:

1. Check if draft exists for this file+session
2. If no draft: copy real file to draft path, write metadata, acquire lock
3. Redirect command to draft path

```ts
function ensureDraft(sessionID: string, filePath: string): string {
  const hash = simpleHash(filePath);
  const ext = path.extname(filePath);
  const draftPath = path.join(dataDir, 'drafts', sessionID, `${hash}${ext}`);

  if (fs.existsSync(draftPath)) return draftPath;

  // Check lock
  const lockPath = path.join(dataDir, 'locks', `${hash}.json`);
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    if (lock.sessionID !== sessionID) {
      throw new Error('File is being edited in another session');
    }
  }

  // Create draft
  fs.mkdirSync(path.dirname(draftPath), { recursive: true });
  fs.copyFileSync(filePath, draftPath);

  // Write metadata
  fs.writeFileSync(
    draftPath + '.meta.json',
    JSON.stringify({
      sessionID,
      realFilePath: filePath,
      filePathHash: hash,
      extension: ext,
      createdAt: Date.now(),
      status: 'active',
    }),
  );

  // Acquire lock
  fs.writeFileSync(lockPath, JSON.stringify({ sessionID, createdAt: Date.now() }));

  return draftPath;
}
```

### Accept flow

1. Flush: `officecli close <draft>`
2. Copy: `fs.copyFile(draft, realPath)`
3. Snapshot: record in version history
4. Cleanup: delete draft, metadata, lock

### Undo flow

1. Discard draft, metadata, lock
2. Real file untouched

### Orphaned draft cleanup

On session end without accept/discard: mark draft as orphaned. On next open of same file: show "You had unreviewed edits — accept or discard?"

### Reference

- Error shape research: `wayfinder/research/001-officecli-error-shape.md`
- opencode snapshot system: `packages/opencode/src/snapshot/index.ts`
