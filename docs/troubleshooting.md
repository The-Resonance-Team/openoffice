# Troubleshooting

## "officecli is not installed"

The document tools shell out to `officecli`. Install it:

```sh
curl -fsSL https://d.officecli.ai/install.sh | bash
```

## The agent reports `LOCKED` / another session holds the file

Only one session may hold an active draft for a file at a time. Locks go
stale after 24h of inactivity and can then be overridden by another session;
the displaced session's draft becomes discoverable and recoverable (accept or
discard) the next time the file is opened. If you see `LOCKED`, wait for the
lock to go stale or finish the other session's work first.

## `openoffice update` fails

- **"checksum mismatch"** — the download didn't match the release's
  SHA256SUMS; the binary was not replaced. Retry, and report it if it
  persists.
- **"no checksum published for ..."** — the release was created without a
  SHA256SUMS file (e.g. an early shakedown release). Nothing was changed.
- **"not applicable in dev"** — `update` replaces the installed binary; run
  it from `npm -g` or `dist/openoffice`, not via `bun run`.

## Update checks are slow or fail offline

The daemon checks GitHub Releases with a 24h cache. Disable checks entirely:

```json
{ "update": { "check": false } }
```

## The daemon won't start

The daemon binds `127.0.0.1` on an ephemeral port and writes its PID/port
file under the data dir (`~/.local/share/openoffice` by default, or
`$XDG_DATA_HOME/openoffice`). If an old `daemon.json` points at a dead
process it is ignored and a new daemon is spawned. Stale daemons can be
killed with `pkill -f "openoffice serve"` and will respawn on next use.

## My edits look stale after accepting

Reads are served from a document's draft while one exists; after accept the
daemon closes any resident document process holding the real file so later
reads see the accepted state. If you still see stale content, restart the
daemon (`pkill -f "openoffice serve"`).

## MCP servers don't appear as tools

- A server whose name matches a native tool is intentionally skipped
  (dogfooding rule).
- Local servers need `command` as an argv array; remote servers need `url`.
- Check the daemon logs for "MCP server X failed to connect".

## Coverage gate fails in CI

`bun test --coverage` (run from `apps/cli`) enforces ≥80% line coverage across `apps/cli/src/`. Add tests
for the uncovered modules (the gate prints the worst offenders) rather than
relaxing the threshold.
