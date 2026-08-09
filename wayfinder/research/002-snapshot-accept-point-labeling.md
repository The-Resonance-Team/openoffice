# 002: Snapshot.Service Accept-Point Labeling

## Current State

### `track()` return type and storage

`track()` returns a **string** — a git tree hash from `git write-tree`.

Storage mechanism: a **shadow git repo** (not the project's `.git`). It:

1. Initializes `git init` in a separate `gitdir` (under `.opencode/snapshot/`)
2. Shares object DB with the source repo via `alternates` (avoids re-hashing large objects)
3. Stages all changed files via `git add --all --sparse`
4. Runs `git write-tree` to produce a tree object (no commits — just trees + blobs)

The hash is an opaque tree SHA stored in `StepStartPart.snapshot`, `StepFinishPart.snapshot`, and `PatchPart.hash`.

### `patch()` method

```
patch(hash) → { hash: string, files: string[] }
```

Computes `git diff --cached --name-only <hash>` against the current index. Returns the original hash and a list of changed file paths. Used by processor to create `PatchPart` records after each tool-call step.

### `diff()` method

```
diff(hash) → string (raw unified diff text)
```

Runs `git diff --cached <hash>` and returns the full diff output. Stored in `Revert.diff`.

### `diffFull()` method

```
diffFull(from, to) → FileDiff[] (structured per-file diffs with patch text, additions, deletions)
```

Used for computing user-facing diffs between two snapshots.

### `restore()` method

```
restore(snapshot) → void
```

Runs `git read-tree <snapshot>` then `git checkout-index -a -f` to restore the working tree to the given snapshot.

### `revert()` method

```
revert(patches: Patch[]) → void
```

For each file in each patch, runs `git checkout <hash> -- <file>` to restore individual files. Batches adjacent same-hash operations.

---

## Session Record Snapshot-Related Fields

### `Session.Info` (session.ts:307)

```ts
const Revert = Schema.Struct({
  messageID: MessageID, // target message to revert to
  partID: optional(PartID), // optional specific part
  snapshot: optional(String), // tree hash for restore point
  diff: optional(String), // unified diff text for display
});

const Info = Schema.Struct({
  // ... other fields ...
  revert: optional(Revert),
  metadata: optional(Metadata), // Record<string, any>
});
```

### `SessionV1.Part` (schema/v1/session.ts)

```ts
StepStartPart  = { type: "step-start", snapshot?: string }
StepFinishPart = { type: "step-finish", reason: string, snapshot?: string, cost, tokens }
PatchPart      = { type: "patch", hash: string, files: string[] }
```

`PatchPart` has **no label, metadata, or accept-point field**. It's a flat `{ hash, files }` struct.

---

## How Revert Consumes Snapshots

`revert.ts` flow:

1. Iterate all messages/parts to find the target part (by `messageID`/`partID`)
2. Collect all `PatchPart` records **after** the target into `patches[]`
3. Take a new snapshot: `snap.track()` → save as `rev.snapshot`
4. If already in a revert state, restore previous: `snap.restore(session.revert.snapshot)`
5. **Revert collected patches**: `snap.revert(patches)` — this checks out files from each patch's hash
6. Compute diff: `rev.diff = snap.diff(rev.snapshot)`
7. Store revert state: `session.setRevert({ revert: rev, summary })`

Key insight: revert uses `Patch` type from snapshot module (`{ hash, files }`) — same shape as `PatchPart`. It does NOT use `diff()` or `diffFull()` for the actual file restoration; it uses `revert()` which does `git checkout <hash> -- <file>` per file.

---

## Proposed Minimal Schema Extension

### Option A: Add `label` to `PatchPart` (recommended)

```ts
// packages/schema/src/v1/session.ts
export const PatchPart = Schema.Struct({
  ...partBase,
  type: Schema.Literal('patch'),
  hash: Schema.String,
  files: Schema.Array(Schema.String),
  label: optional(Schema.String), // NEW: "accept" | undefined
}).annotate({ identifier: 'PatchPart' });
```

### Option B: Use `Session.metadata` for accept-point tracking

Add a structured field to session metadata:

```ts
// On Session.Info
metadata: {
  acceptPoints: [{ messageID: string, partID?: string, snapshot: string }]
}
```

### Recommended: Option A + lightweight session-level tracking

**PatchPart.label** — marks individual patch parts as `"accept"` when user accepts an edit preview. Backward-compatible (optional field, existing consumers ignore it).

**Session metadata** — track accept-point history at session level:

```ts
metadata: {
  acceptPoints: [{ messageID, partID, snapshot, timestamp }];
}
```

This is written by the accept handler (future code) and read by Version History UI.

### Minimal implementation surface

| File                                         | Change                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/schema/src/v1/session.ts`          | Add `label?: string` to `PatchPart`                                                      |
| `packages/opencode/src/session/revert.ts`    | No change needed — ignores `label`                                                       |
| `packages/opencode/src/session/processor.ts` | No change needed — creates `PatchPart` without label                                     |
| Future: accept handler                       | Sets `label: "accept"` on the relevant `PatchPart` and writes to `metadata.acceptPoints` |

### `Snapshot.Patch` type (internal)

The internal `Snapshot.Patch` type (`{ hash, files }`) stays unchanged. It's a transport type between `patch()` and `revert()`. Accept-point labeling lives on the **persisted** `PatchPart`, not the internal type.

---

## Breaking-Change Risks

| Risk                                  | Level    | Mitigation                                                                         |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Adding `label` to `PatchPart` schema  | **Low**  | Optional field; existing consumers destructure `{ hash, files }` and ignore extras |
| Database schema change                | **None** | Parts are stored as JSON in SQLite; new fields persist transparently               |
| `revert.ts` consuming `PatchPart`     | **None** | It destructures `{ hash, files }` — extra fields are ignored                       |
| `diffFull()` returning patch data     | **None** | Returns `FileDiff[]` from git, not from `PatchPart` records                        |
| `Session.Patch` (session update type) | **None** | Unrelated — it's for updating session fields, not parts                            |
| SDK/API consumers                     | **Low**  | SDK types are auto-generated from schema; adding optional field is non-breaking    |

**No breaking changes.** The `label` field is optional and all existing consumers use structural typing or destructure known fields.
