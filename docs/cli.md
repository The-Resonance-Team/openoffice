# CLI reference

```
openoffice — an LLM agent CLI for office document work.

Usage:
  openoffice                Interactive chat (auto-spawns the daemon)
  openoffice serve          Run the daemon in the foreground (auto-spawned on demand)
  openoffice update         Check GitHub Releases and update the installed binary
  openoffice --version      Print the version
  openoffice --help         Show this help
```

## `openoffice` (default)

Starts an interactive chat session. If no daemon is running for the current
user it is auto-spawned (detached) and discovered via its PID/port file
(`daemon.json` under the data dir); the CLI attaches to it as a client.

At startup the client asks the daemon whether an update is available and
prints a hint when one is. Type a message and press Enter to run a turn;
Ctrl+C ends the session.

## `openoffice serve`

Runs the daemon in the foreground (used for debugging; normally the daemon is
spawned detached by the CLI). Prints the listening port. The daemon hosts the
session loop, tools, drafts, and the HTTP/SSE API on `127.0.0.1`.

## `openoffice update`

Forces a fresh update check against GitHub Releases. The newest tag by semver
(stable and pre-release both qualify) is offered; the matching platform binary
is downloaded, verified against the release's SHA256SUMS, and swapped into
place atomically (the previous binary is kept as `.old` until the next
successful run). Refuses to run from the dev runner (`bun run`) — run it from
the installed binary.

## `openoffice --version`

Prints the version. Compiled binaries embed the version at build time.

## `openoffice --help`

Prints this reference.
