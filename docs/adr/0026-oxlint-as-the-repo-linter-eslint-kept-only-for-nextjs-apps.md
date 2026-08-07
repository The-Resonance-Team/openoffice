# 0026 — oxlint as the repo linter; eslint kept only for Next.js apps

## Status

Accepted.

## Context

Linting was split across two tools with no stated rationale: `apps/cli`, `packages/core` and `packages/server` already ran oxlint (bare, no config — chosen at scaffolding, wayfinder #101), while `apps/web`, `apps/cloud-web` (eslint-config-next) and `apps/cloud-api` (typescript-eslint `recommendedTypeChecked` + eslint-plugin-prettier) ran eslint. `packages/schema` and `packages/protocol` had no lint at all. `cloud-api`'s eslint gate was red on every fresh install: the postinstall `prisma generate` writes an unformatted client under the gitignored `src/generated/`, and eslint linted it (the config ignored only itself), so eslint-plugin-prettier flagged it — locally it appeared green only against a stale, manually formatted client.

## Decision

oxlint is the repo linter. The two Next.js apps keep eslint (eslint-config-next's `@next/next` rules — `next/no-img-element`, `next/next-script`, … — have no oxlint equivalent). `apps/cloud-api` migrates to oxlint; `packages/schema` and `packages/protocol` gain `lint: oxlint`; a single behavior-neutral root `.oxlintrc.json` (default categories untouched, `env: {node, jest}`, `no-explicit-any` off) serves all six oxlint workspaces. `cloud-api`'s lint script adds `prettier --check` (formatting is prettier's job, never the linter's), scoped to hand-written `src/`+`test/`; the gitignored `src/generated/` client is excluded via `apps/cloud-api/.prettierignore`.

Accepted losses, deliberately:

- **Type-aware linting in cloud-api.** oxlint is not type-aware; `recommendedTypeChecked`'s rules (`no-unsafe-*`, `no-misused-promises`, `restrict-plus-operands`, …) have no oxlint equivalent and are silently dropped. The codebase passed them clean (0 violations); `tsc --noEmit` remains the type safety gate. If type-aware static checks are ever wanted again, the seam is a per-directory oxlint override with an additional `tsc`-based checker — or reinstating eslint in that workspace.
- **eslint-plugin-prettier.** Replaced by `prettier --check` in the lint script; the dead `lint:check` script (identical to `lint`, referenced nowhere) was deleted.

## Consequences

- `turbo run lint` covers all eight workspaces: oxlint in six, eslint-config-next in the two web apps. CI (`bun run lint` + `lint:boundaries`) is unchanged.
- Lint, format, and typecheck are three separate concerns: oxlint (static analysis), prettier (formatting), tsc/tsgo (type checking). No lint script fixes formatting; no linter is type-aware.
- The oxlint baseline is warnings-only for `packages/core` (4 `no-unused-vars`) and `packages/server` (3: 2 `no-unused-vars`, 1 `unicorn`), matching pre-migration state; cleaning them is out of scope.
- A future reader who wonders why cloud-api lacks type-aware linting should read this ADR, not "fix" it by reinstating eslint.
