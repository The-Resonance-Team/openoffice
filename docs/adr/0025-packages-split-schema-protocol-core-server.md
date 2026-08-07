# 0025 — Packages split: schema, protocol, core, server; cloud apps

## Status

Accepted.

## Context

ADR 0024 moved the single package into a Bun-workspace monorepo (`apps/cli` + `apps/web`). The Cloud context (ADR 0017, ADR 0005) adds a hosted service — orgs, teams, roles, Cred Proxy, analytics — that must compile against the daemon's data model and wire contract, and it cannot import `apps/cli` internals to get them.

opencode solves the same problem with `packages/schema` (Effect schemas), `packages/protocol` (HttpApi), `packages/core`, `packages/server`; openoffice is a reference-source mirror of opencode's design (CLAUDE.md: "always reference the opencode source"). The restructure follows PR 52's monorepo shape and keeps the cloud service in `apps/cloud-api` + `apps/cloud-web`.

## Decision

Four packages, one direction of dependence — `schema ← protocol ← core ← server ← cli`:

- **`@openoffice/schema`** — the shared data model, pure types, zero dependencies: `Session`, `Part`/`WithParts`, `MessageInfo`, `Role`, `ModelRef`, `TokenUsage`. One home, consumed by engine, daemon wiring, wire contract, and both web clients. Core's `session/types.ts` and `session/parts.ts` became re-export shims so their consumers changed nothing.
- **`@openoffice/protocol`** — the daemon HTTP/SSE contract, types only: `EventMap` (SSE event payloads), `DaemonClient` (route surface), `StreamHandlers`, `UpdateStatus`. The fetch implementation stays in `packages/server` because it owns spawn/auth plumbing; the interface is the seam both sides compile against.
- **`@openoffice/core`** — the engine: agent, auth, config, draft, events bus (redaction stays here), history, llm, mcp, office, session, skills, tool. Domains keep the deep-module entry-point discipline from ADR 0001, now enforced per-package by the root `.dependency-cruiser.cjs`.
- **`@openoffice/server`** — daemon process wiring: `createApp` (dependency-injected via `ServerDeps` — the seam that already existed), the client implementation, spawn/lifecycle, self-update, version, data dir.
- **`apps/cli`** — thin entry: `src/index.ts` (arg parsing) + `bin/`, tests. Published as `openoffice`.
- **`apps/cloud-api`** — NestJS + Postgres + OpenAuth.js (ADR 0005), scaffold with a health endpoint; consumes `@openoffice/*`.
- **`apps/cloud-web`** — Next.js (ADR 0005), scaffold page typed against `@openoffice/schema`.
- `apps/web` (daemon web client from ADR 0024) unchanged.

Cross-package imports go through the bare `@openoffice/*` specifier (the package entry, `src/index.ts`); relative imports may not leave a package — dep-cruiser enforces both, plus the core-domain deep-module rules.

## Consequences

- Both cloud apps compile against the daemon's model/contract without touching daemon internals — the Cred Proxy and analytics work (cloud ADR 0002, 0003) slots in behind existing seams: a new provider adapter behind `core/llm`, a new `core`-adjacent domain behind `@openoffice/core`.
- The published binary bundles the workspaces at build time; `apps/cli` keeps the version and the `bin` entry.
- One package barrel per package is now sanctioned (opencode shape); the no-barrel rule from ADR 0001 still applies inside `packages/core`'s domains.
- `EventMap` lives in protocol but the bus (redaction, emit) in core — `core → protocol` is a type-only edge.
- Tests move with their code: server tests in `packages/server/src/server/tests`, domain tests in `packages/core/src/*/tests`, cross-cutting integration tests stay in `apps/cli/test`.
