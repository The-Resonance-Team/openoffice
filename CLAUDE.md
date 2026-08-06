## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map 1:1 to labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/` (ADR 0001). See `docs/agents/domain.md`.

### Deep modules

Domains under `packages/core/src/` are deep modules — import only through a domain's root entry points, never subfolder internals. See `packages/core/src/README.md` before adding or importing one.

### Monorepo

Bun workspaces + Turborepo. `packages/schema` (shared data model), `packages/protocol` (daemon HTTP/SSE contract), `packages/core` (engine), `packages/server` (daemon process wiring). `apps/cli` is the published `openoffice` package; `apps/web` is the daemon web client; `apps/cloud-api` + `apps/cloud-web` are the hosted Cloud service (ADR 0005). Root is private and versionless — the published version lives in `apps/cli/package.json`. Run tasks with `turbo run <task>` from the root; `bun test` and friends must run with `apps/cli` as cwd. Cross-package imports use the bare `@openoffice/*` specifier, never relative paths. See ADR 0024, ADR 0025.
