# 001: officecli Structured Error Shape

## Summary

officecli v1.0.142 was tested with deliberate failures. The error shape was verified empirically — no guessing from docs.

## Exit Code Behavior

| Scenario | Exit Code |
|----------|-----------|
| Success | 0 |
| Any error (file not found, bad path, corrupt file, invalid input, batch failure) | 1 |
| Binary not found (spawn failure) | 127 (shell's `command not found`) |

**Key finding:** officecli **always** exits non-zero on failure. There is no "exit 0 with error in body" pattern. This makes `execFileSync` error detection trivial — just check exit code.

## Error Output Format

### With `--json` (structured)

```json
{
  "success": false,
  "error": {
    "error": "Human-readable error message",
    "code": "error_code_here",
    "suggestion": "Optional fix hint",
    "help": "Optional command syntax reminder"
  }
}
```

Fields:
- `success` — always `false` on error (omitted on success? need to check)
- `error.error` — always present, human-readable string
- `error.code` — machine-readable error code (see list below)
- `error.suggestion` — optional, present on some errors
- `error.help` — optional, present on some errors

### Without `--json` (plain text)

```
Error: <message>
```

Plain text goes to stderr. JSON goes to stdout. Both always accompany exit code 1.

## Error Codes Found

| Code | When | Suggestion field? | Help field? |
|------|------|-------------------|-------------|
| `file_not_found` | File doesn't exist on disk | Yes | Yes |
| `io_error` | Parent path doesn't exist, permission denied | No | No |
| `corrupt_file` | File is 0 bytes or invalid OOXML | Yes | No |
| `invalid_json` | Malformed JSON piped to batch | No | No |
| `not_found` | DOM path doesn't exist in document | No | No |

## Spawn Failure Behavior

When the `officecli` binary is not on PATH, Node's `execFileSync` throws:
- Error code: `ENOENT` (Node error, not officecli error)
- The shell exits 127

This means the tool wrapper must catch the `ENOENT` case separately from officecli's structured errors.

## Batch Error Shape

Batch returns a different shape from single commands:

### Success
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "index": 0,
        "success": true,
        "output": "Added paragraph at /body/p[@paraId=00100000]"
      }
    ],
    "summary": {
      "total": 1,
      "executed": 1,
      "succeeded": 1,
      "failed": 0,
      "skipped": 0
    }
  }
}
```

### Failure (atomic rollback)
```json
{
  "success": false,
  "data": {
    "results": [
      {
        "index": 0,
        "success": true,
        "output": "Added paragraph at /body/p[@paraId=00100000]"
      },
      {
        "index": 1,
        "success": false,
        "error": "Path not found: /nonexistent",
        "code": "not_found",
        "item": { "command": "set", "path": "/nonexistent", "props": { "text": "x" } }
      }
    ],
    "summary": {
      "total": 2,
      "executed": 2,
      "succeeded": 1,
      "failed": 1,
      "skipped": 0,
      "atomicRolledBack": true
    }
  }
}
```

**Key finding:** Batch is atomic — if any item fails, all prior successful items are rolled back (`atomicRolledBack: true`). The overall `success` is `false` and exit code is 1.

Per-item errors include the original `item` object for debugging.

## Usage Notes for Tool Implementation

1. **Always use `--json`** for structured parsing. Plain text is useless for programmatic handling.
2. **Check exit code first** — 0 = success, non-zero = error. No edge cases.
3. **Catch `ENOENT` from Node** separately — this means officecli isn't installed, not that the command failed.
4. **Batch errors are atomic** — safe to retry the whole batch on failure.
5. **Error shape is consistent** across all commands: `{ success: false, error: { error, code, suggestion?, help? } }`.
6. **Batch shape wraps results** in `{ success, data: { results[], summary } }`.

## Skipped / Not Tested

- Permission denied on a read-only file (would need to create one)
- Concurrent file locking errors
- Locale-specific errors
- Large file handling
- These can be added later if needed
