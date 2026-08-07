# 0029 — jest stays the cloud-api test runner

## Status

Accepted.

## Context

`apps/cloud-api` was scaffolded with jest 30 + ts-jest + supertest: unit specs are colocated (`*.spec.ts`), a `setupFiles` entry (`test/setup-env.ts`) injects `JWT_SECRET` before any module boots, and an e2e config (`test/jest-e2e.json`) drives `test/app.e2e-spec.ts` against the full `AppModule`. Meanwhile the rest of the repo runs `bun test` (packages, cli), and the reference stack (Ecopick PR #206) migrated its API to vitest with `setupFiles` + a separate e2e config.

Two gaps made cloud-api's tests CI-invisible: the CI unit matrix filters cloud-api out (`--filter=!cloud-api`), and the e2e spec's health assertion required a live Postgres, so it could not run on a runner without a database. Additionally, the npm scripts use a POSIX-only `NODE_OPTIONS=...` prefix — cmd.exe (npm's default script shell on Windows) cannot parse it, so the windows-latest matrix leg cannot run cloud-api's jest as written.

## Decision

jest stays the cloud-api runner. No migration to vitest or bun test:

- Adopt the reference stack's _patterns_, not its runner: shared env setup via `setupFiles` (already in place), e2e config kept alive, unit specs colocated.
- The e2e spec boots the full `AppModule` with a stubbed `PrismaService` (health DB ping served by a stub), so e2e runs DB-free anywhere — including CI. Real DB reachability remains a local-compose concern (`docker compose up -d postgres`).
- CI includes cloud-api: unit tests join the `unit` job on the self-hosted Linux runner; the windows-latest leg keeps the `--filter=!cloud-api` exclusion (POSIX-only scripts; Windows support for the jest leg is out of scope until the scripts become cross-platform). A `test:e2e` step runs cloud-api e2e on the self-hosted e2e job.

## Consequences

- The repo runs two test runners: `bun test` everywhere, jest in cloud-api. This is deliberate, not drift.
- cloud-api tests are finally gated in CI; a broken scaffold can no longer land green.
- Windows CI does not exercise cloud-api jest. If a Windows developer needs it, the fix is script portability (e.g. `cross-env` or invoking jest via `node`), a separate change.
