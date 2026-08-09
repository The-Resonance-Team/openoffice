# Version History

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [TUI](117-tui.md)
**Blocked by**: [Accept/Undo Routes](115-accept-undo.md)
**Assignee**: _(unclaimed)_

## Question

Record accepted edits for version history — timestamps, snapshots, per-file indexing.

### Storage

JSON file per session: `~/.local/share/openoffice/history/{sessionID}.json`

```ts
interface AcceptPoint {
  filePath: string;
  timestamp: number;
  snapshotHash: string; // hash of the file state after accept
}

interface VersionHistory {
  sessionID: string;
  points: AcceptPoint[];
}
```

### Recording

On accept:

```ts
function recordAcceptPoint(sessionID: string, filePath: string): void {
  const hash = computeFileHash(filePath); // hash after accept
  const history = loadHistory(sessionID);
  history.points.push({ filePath, timestamp: Date.now(), snapshotHash: hash });
  saveHistory(sessionID, history);
}
```

### Browse API

```
GET /api/sessions/:sessionID/versions?filePath=<path>
```

Returns list of accept-points for a file, sorted by timestamp descending.

### Revert-to-version API

```
POST /api/sessions/:sessionID/revert
Body: { filePath: string, snapshotHash: string }
```

Find the accept-point, restore file from snapshot.

### v1 scope

**Minimal**: just record snapshots. No browse UI. Revert only to immediately preceding state. Full browse in v2.

### Reference

- opencode snapshots: `packages/opencode/src/snapshot/index.ts`
- opencode revert: `packages/opencode/src/session/revert.ts`
