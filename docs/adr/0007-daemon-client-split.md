# 0007 — Daemon/client split for the session loop

Issue #4 (draft lifecycle, accept/undo) needed an HTTP boundary so the not-yet-built UI could accept/undo without letting the model re-trigger the decision as a tool call. That requirement — plus the desktop app in issue #5 needing the same server for its Electron renderer — meant the CLI itself becomes a daemon: `openoffice serve` hosts the session loop, tools, and an HTTP/SSE API. The TUI and the desktop renderer are thin clients that connect to it rather than running the agent loop in-process.

`openoffice` (bare invocation) auto-spawns the daemon detached if none is running for the current user, then attaches as a client — no separate `serve` step required for the common case. Streaming (tokens, tool events) goes over Server-Sent Events, one connection per session; SSE was chosen over WebSocket because the client only ever needs to receive a stream, never push outside of separate POST routes.

This reshapes how the app is invoked compared to issues #1–#3, where `index.ts` ran the session loop directly in a single process. That mode becomes one client implementation talking to a daemon instead of the whole program.

## Considered options

- **Keep it embedded**: one process runs both the Hono server and the TUI. Rejected because the desktop app's Electron renderer is a genuinely separate process and needs the same HTTP boundary anyway — building two different integration paths (embedded for TUI, networked for desktop) was more surface area than building the daemon once.
