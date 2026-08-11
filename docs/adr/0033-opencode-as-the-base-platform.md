# 0033 — opencode as the base platform

## Status

Accepted.

## Context

OpenOffice's agent machinery (session loop, parts schema, compaction, overflow, retry, event redaction) was hand-rolled and largely *ported* from the opencode codebase — `CONTEXT.md` directed every feature to reference the opencode source at `/Users/xirothedev/workspace/opencode` and copy what fit. The port drifts from its source: years of upstream fixes are absent, while our own edge-case patches live in code that is increasingly divergent. We asked whether to "integrate the opencode SDK" and concluded the SDK alone is only a wire client — the features live in opencode's server. Decision space: keep mirroring (status quo), swap to opencode as a *base platform* we build on top of, or wrap the binary as an opaque engine.

The opencode fork (1.18.15, local checkout) verifies the base is viable: `opencode serve` is genuinely headless with HTTP Basic auth (`OPENCODE_SERVER_PASSWORD`) — the same auth shape our daemon already uses; config supports `permission` rules (ask/allow/deny per tool, deny hides tools from the model) and per-provider `options.baseURL` (the Cred Proxy seam); custom tools load in-process from config-dir tool files, plugins, or MCP; `noReply` prompting exists.

## Decision

**OpenOffice is built *on* opencode, not mirrored from it.** opencode's server is the agent base platform; openoffice owns the office-document domain on top.

- **Engine**: the daemon spawns `opencode serve` on loopback as a subprocess (vendored fork binary, checksum-verified, pinned version, swapped by our existing Update machinery) and drives it via `@opencode-ai/sdk`. Our hand-rolled loop (`llm/`, session schema, compaction, overflow, retry, redaction) is deleted in a hard cutover — no dual-engine flag, no legacy path.
- **Office tools**: `officecli` ships as **local tool files** written into the spawned server's config directory (`OPENCODE_CONFIG_DIR`, + `OPENCODE_CONFIG_CONTENT`), not as an MCP server. The tool file is self-contained (the base process has no openoffice packages) and calls back into the daemon's token-gated `/internal/officecli` route, which runs the real draft-aware tool — so all document mutation flows officecli → draft → accept (ADR 0008 survives). Permission rules deny opencode's generic `write`/`bash`/`edit` globally — a superset of path-scoped deny, since the officecli tool file is the only document tooling.
- **Clients**: the cli/desktop/web surfaces stay ours, speaking the SDK through the daemon's existing Basic-auth outer layer. The daemon remains the product's HTTP/SSE boundary.
- **Domain seam**: **Session is opencode's entity** (its schema, lifecycle, parts); **Draft is openoffice's** (draft manager, locks, accept/undo/revert, version history), attached by session id + file path hash. `packages/schema`'s ported SessionV1 types are replaced by `@opencode-ai/sdk` types.
- **Auth**: all provider auth comes from opencode — `auth.json` is the single credential source; the cloud Cred Proxy becomes a config generator writing `provider.<id>.options.apiKey/baseURL` into the generated `opencode.json`. Direct logins use opencode's `auth login`.
- **Share**: disabled for now (`share: "disabled"`); opencode's share client targets its hosted API (`opncd.ai`), which conflicts with our cloud — revisit through our own cloud later.
- **Rule**: the "Reference source: always reference the opencode source" rule in `CONTEXT.md` is replaced — opencode is a dependency and a process, not a reference to copy from.

## Consequences

- Hard cutover done: `packages/core/src/llm/`, the session loop (compaction, overflow, retry, max-steps, system prompt), and the credential store are deleted. The mirror `SessionStore` survives as the transcript store for share replay (fed by the event bridge) and the sweep's staleness check. The e2e suite (officecli-on-opencode) is the gate before release and gates on the vendored base binary.
- The base binary is vendored into releases: `build.yml` builds the opencode fork at its pinned commit, and `performUpdate` downloads, checksum-verifies (SHA256SUMS), and swaps `opencode-<os>-<arch>` into `<dataDir>/bin/opencode` alongside the openoffice binary — one update command handles both.
- Base events bridge into the daemon bus at the single redaction choke point (CONTEXT.md Event safety): every mapped event is emitted through the bus, and user/assistant messages are mirrored to the store for share replay.
- opencode moves fast (15k commits upstream) — the vendored fork, pinned and checksum-verified, absorbs that churn behind our Update boundary instead of our compile graph.
- The daemon's value shifts from "agent engine" to "document domain + proxy + auth boundary", which is the actual product surface.
- The agent-path decisions (ADR 0002 ModelMessage, 0003 streamText+stopWhen, 0009 provider auth, 0023 event redaction, 0024 retry, 0005 session storage) are no longer the engine's implementation — the base owns those concerns — but their ADRs are left in place as historical record, not marked superseded. ADR 0008 (single write path) and 0006 (document engine) survive.
- `CONTEXT.md` glossary terms owned by the base (Session, Message, Part, Step, Provider, Permission, Tool) now describe opencode's entities; openoffice terms (Draft, Lock, Accept, Undo, Revert, Accept-point, Version history, Preview, Document toolkit) are unchanged.
