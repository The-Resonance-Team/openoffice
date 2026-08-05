## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map 1:1 to labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/` (ADR 0001). See `docs/agents/domain.md`.

### Deep modules

Domains under `apps/cli/src/` are deep modules — import only through a domain's root entry points, never subfolder internals. See `apps/cli/src/README.md` before adding or importing one.

### Monorepo

Bun workspaces + Turborepo. `apps/cli` is the published `openoffice` package; `apps/web` is the Next.js frontend. Root is private and versionless — the published version lives in `apps/cli/package.json`. Run tasks with `turbo run <task>` from the root; `bun test` and friends must run with `apps/cli` as cwd. See ADR 0024.
