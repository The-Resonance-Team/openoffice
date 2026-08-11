# 0033 — opencode as the base platform

## Status

Accepted.

## Context

OpenOffice's agent machinery (session loop, parts schema, compaction, overflow, retry, event redaction) was hand-rolled and largely *ported* from the opencode codebase — `CONTEXT.md` directed every feature to reference the opencode source at `/Users/xirothedev/workspace/opencode` and copy what fit. The port drifts from its source: years of upstream fixes are absent, while our own edge-case patches live in code that is increasingly divergent. We asked whether to "integrate the opencode SDK" and concluded the SDK alone is only a wire client — the features live in opencode's server. Decision space: keep mirroring (status quo), swap to opencode as a *base platform* we build on top of, or wrap the binary as an opaque engine.

The opencode fork (1.18.15, local checkout) verifies the base is viable: `opencode serve` is genuinely headless with HTTP Basic auth (`OPENCODE_SERVER_PASSWORD`) — the same auth shape our daemon already uses; config supports `permission` rules (ask/allow/deny per tool, deny hides tools from the model) and per-provider `options.baseURL` (the Cred Proxy seam); custom tools load in-process from config-dir tool files, plugins, or MCP; `noReply` prompting exists.

## Decision

**OpenOffice is built *on* opencode, not mirrored from it.** opencode's server is the agent base platform; openoffice owns the office-document domain on top.

- **Engine**: the daemon spawns `opencode serve` on loopback as a subprocess (vendored fork binary, checksum-verified, pinned version, swapped by our existing Update machinery) and drives it via `@opencode-ai/sdk`. Our hand-rolled loop (`llm/`, session schema, compaction, overflow, retry, redaction) is deleted in a hard cutover — no dual-engine flag, no legacy path.
- **Office tools**: `officecli` ships as **local tool files** written into the spawned server's config directory (+ `OPENCODE_CONFIG_CONTENT`), not as an MCP server. Permission rules deny opencode's generic `write`/`bash` on document paths so all document mutation flows officecli → draft → accept (ADR 0008 survives).
- **Clients**: the cli/desktop/web surfaces stay ours, speaking the SDK through the daemon's existing Basic-auth outer layer. The daemon remains the product's HTTP/SSE boundary.
- **Domain seam**: **Session is opencode's entity** (its schema, lifecycle, parts); **Draft is openoffice's** (draft manager, locks, accept/undo/revert, version history), attached by session id + file path hash. `packages/schema`'s ported SessionV1 types are replaced by `@opencode-ai/sdk` types.
- **Auth**: all provider auth comes from opencode — `auth.json` is the single credential source; the cloud Cred Proxy becomes a config generator writing `provider.<id>.options.apiKey/baseURL` into the generated `opencode.json`. Direct logins use opencode's `auth login`.
- **Share**: disabled for now (`share: "disabled"`); opencode's share client targets its hosted API (`opncd.ai`), which conflicts with our cloud — revisit through our own cloud later.
- **Rule**: the "Reference source: always reference the opencode source" rule in `CONTEXT.md` is replaced — opencode is a dependency and a process, not a reference to copy from.

## Consequences

- Hard cutover means one release loses ~4 years of ported edge-case fixes at once; the e2e suite (officecli-on-opencode) is the gate before release.
- opencode moves fast (15k commits upstream) — the vendored fork, pinned and checksum-verified, absorbs that churn behind our Update boundary instead of our compile graph.
- The daemon's value shifts from "agent engine" to "document domain + proxy + auth boundary", which is the actual product surface.
- ADRs 0002, 0003, 0009 (credential store), 0023, 0024 are superseded for the agent path; 0008 (single write path), 0006 (document engine) survive. ADR 0005's session schema is superseded by opencode's own SQLite.
- `CONTEXT.md` glossary terms owned by the base (Session, Message, Part, Step, Provider, Permission, Tool) now describe opencode's entities; openoffice terms (Draft, Lock, Accept, Undo, Revert, Accept-point, Version history, Preview, Document toolkit) are unchanged.
