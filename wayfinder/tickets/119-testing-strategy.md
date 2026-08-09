# Testing Strategy

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocked by**: [Version History](116-version-history.md)
**Assignee**: _(unclaimed)_

## Question

What level of testing is needed for v1?

### Test levels

**1. Unit tests** (bun test):

- Tool definitions validate correctly
- Config loading works
- Event system fires/receives
- Draft path computation is correct
- Lock acquire/release works

**2. Integration tests**:

- officecli create/read/edit per format
- Agent loop completes a turn
- Accept/undo routes work end-to-end
- MCP connection works

**3. E2E tests**:

- Full draft lifecycle: create → edit → preview → accept
- Undo flow: create → edit → undo → real file untouched
- Concurrent access: two sessions, one locks

### What to test first

Unit tests for the draft lifecycle — it's the most critical and error-prone system.

### Test structure

```
src/
  __tests/
    tool.test.ts         — tool registry, validation
    officecli.test.ts    — officecli tool (mocked)
    draft.test.ts        — draft lifecycle
    session.test.ts      — session management
    config.test.ts       — config loading
```

### Reference

- opencode tests: `packages/opencode/test/` (41 subdirectories)
- bun test: `https://bun.sh/docs/cli/test`
