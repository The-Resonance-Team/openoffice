# 0027 — GitHub Actions caching and version policy

## Status

Accepted.

## Context

CI ran everything cold. Turbo's local cache lived in `node_modules/.cache`, which `actions/checkout` (clean: true) wiped every run; `setup-bun cache: true` cached only the bun binary, so all seven jobs per PR ran `bun install` from scratch; `unit`/`coverage` bypassed turbo entirely with bare root-level `bun test`; `e2e` re-downloaded officecli every run; and no `dependabot.yml` existed, so action versions went stale silently (`setup-node` v4 → v7, `github-script` v7 → v9, `trusted-signing-action` v0 → v2). Measured baseline: `build-web` ~15 min dominated the run; all self-hosted jobs were ~20 s; windows `unit` ~2 min.

## Decision

Caching, three layers:

- **Task cache**: turbo, with the local L1 dir moved out of the workspace (`TURBO_CACHE_DIR` set via a `GITHUB_ENV` step on self-hosted jobs — turbo does not expand `~`/`$HOME` in env values, and the workflow `env:` block is literal) plus the **Vercel remote cache as shared L2**. Remote cache activates when the `TURBO_TEAM` repo variable and `TURBO_TOKEN` secret exist; empty values disable it cleanly (verified against turbo 2.10.8), so CI works before the credentials are provisioned.
- **Dependency cache**: `actions/cache` for `~/.bun/install/cache` keyed on `bun.lock`, on the hosted `build-web` job only (restore always, save on `main`). Self-hosted runners get this for free — the runner's persistent `HOME` keeps bun's install cache and the officecli binary warm across runs; officecli is therefore _not_ separately cached.
- **No `actions/cache` for `.turbo`**: the Vercel remote cache replaces it; Vercel's cache is content-addressed, so PR-run churn is harmless (unlike GitHub's LRU-evicted blob store, which is why `bun.lock` cache saves are gated to `main`).

Test coverage: `unit` now runs `turbo run test --filter=!cloud-api` (same suite as the old bare run — cli's script ignores e2e, `cloud-api` jest is filtered, `cloud-web` has no test task). `coverage` stays a bare root run: the aggregate lcov report plus the `check-coverage.ts 45` gate is real behavior turbo's per-package coverage would fragment.

Version policy: every action is SHA-pinned with a version comment, updated by a weekly grouped Dependabot PR (`github-actions` ecosystem, `groups.actions`). Exception: `actions/checkout` stays on a single major tag (`@v7`) — enforced by the CI-contract test (`apps/cli/test/ci-contract.test.ts`) that every workflow uses the same checkout major. Exceptions: `anomalyco/opencode/github@latest` floats deliberately — dogfooding the parent project; the comment on that step records why. Bumped now: `setup-node` v7, `github-script` v9, `trusted-signing-action` v2 (v2's inputs verified compatible — `trusted-signing-account-name` kept as an alias).

## Consequences

- `build-web` on a turbo cache hit drops from ~15 min to ~1 min; all turbo tasks across PRs share the Vercel L2 cache once `TURBO_TEAM`/`TURBO_TOKEN` are set.
- The one manual step: create a Turborepo team/token on Vercel and set the repo variable + secret. Until then, CI is unchanged (local-only).
- `setup-node`/`github-script`/`trusted-signing-action` majors moved under Dependabot's watch — a future reader should not "fix" the SHA-pins back to floating tags.
- Deliberately not done: `.next/cache` persistence (turbo cache restore covers the common unchanged-inputs case; add only if profiled src-changed builds are slow), remote cache on the coverage job (bare `bun test`), and cache read-only flags on PRs (content-addressed cache makes them unnecessary).
