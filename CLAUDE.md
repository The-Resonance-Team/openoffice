## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map 1:1 to labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/` (ADR 0001). See `docs/agents/domain.md`.

### Deep modules

Domains under `src/` are deep modules — import only through a domain's root entry points, never subfolder internals. See `src/README.md` before adding or importing one.
