# 0010 — Session share is read-only; concurrent multi-user editing is not built

`map.md` locks "collaboration/multi-user" as out of scope. Issue #11 reopens a narrow slice of it, scoped to exactly what opencode itself proved out: reading opencode's `share/session.ts` and `sync/README.md` shows opencode's own model is a config-gated, revocable, read-only share URL (`share`), plus single-writer/multi-viewer event replay for one user's own devices (`sync`). Concurrent multi-writer editing does not exist anywhere in opencode — there is no OT/CRDT, no multi-writer session model.

openoffice's share (issue #11) copies the read-only URL pattern only. It does not add sync (multi-device replay for one user) or concurrent editing. A share token can view a session's transcript and edit previews over SSE; it cannot reach accept/undo/revert routes at all, enforced at the route layer.

## Considered options

- **Concurrent multi-writer editing**: rejected — would require OT/CRDT over OOXML, a fundamentally different editing model than officecli's whole-file command interface. Not attempted because there is no proven reference for it, not even in opencode.
- **Also building sync (multi-device, single-writer)**: deferred, not rejected — genuinely useful, but adds an event-sourcing replay model for a benefit (same-user multi-device) that wasn't the immediate ask. Revisit if needed.
