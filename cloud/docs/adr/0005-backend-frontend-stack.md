# 0005 — Cloud backend is NestJS + Postgres on SST/AWS; frontend is Next.js + Chart.js

We looked at opencode's own hosted console (same problem: accounts, billing, auth, usage dashboards), which uses SST v3 + Cloudflare Workers + Postgres/Drizzle + OpenAuth.js on the backend, and SolidJS/solid-start + Vite + Chart.js on the frontend. Framework choice: NestJS instead of Workers-shaped functions (matches the team's existing NestJS/Next.js/axios conventions), Next.js instead of SolidJS (larger hiring pool, same axios-generic-interceptor API client pattern used elsewhere). Chart.js carries over unchanged — framework-agnostic, already proven for this exact problem. Auth does **not** carry over: OpenAuth.js was dropped for an in-house NestJS+Passport+JWT stack (see ADR 0006) once the auth design session had the EcoPick platform's proven self-hosted implementation as a reference.

Deploy/infra tool: **SST**, not plain Docker — corrected from this ADR's first version, which wrongly treated "adopt SST" and "adopt Cloudflare Workers" as the same choice. They aren't: SST's `Cluster`/`Service` components deploy a Dockerfile-built container to AWS Fargate — NestJS runs there unchanged, no Workers runtime involved. SST's `Postgres` component provisions RDS with typed `Link` into app code (no manual env-var wiring), and its `Secret` component (encrypted at rest, `sst secret set`, decrypted at startup by the SDK) is a close-to-drop-in mechanism for issue #33's Cred Proxy — storing an Org's provider API key server-side without hand-rolling encryption.

## Considered options

- Plain Docker Compose + self-managed Postgres + hand-rolled secrets handling — rejected: SST's `Secret`/`Postgres`/`Link` remove exactly this custom plumbing, for a tool already proven at the maintainer scale this needs (opencode's own console runs on it).
- Mirror opencode's Workers/SolidJS choice too — rejected: no existing team experience with Workers or Solid; SST's container path (`Cluster`/`Service`) gets the infra-tool benefit without forcing the edge-function framework shift.
- OpenAuth.js for auth — rejected: in-house stack chosen instead, see ADR 0006.

## Consequences

- AWS + Pulumi (SST's underlying IaC engine) become real dependencies for the Cloud context specifically — not the root CLI/daemon, which stays cloud-provider-agnostic entirely.
- `sst dev` gives live local development against real cloud resources — worth using during #30's scaffolding instead of purely local Docker Postgres for the Cloud service (the root daemon's own local dev, e.g. session storage, is unaffected and keeps using Docker Postgres per the standing local-dev rule).
- Auth runs on our own NestJS code, not a third-party provider — the auth surface (sign-in, sessions, keys) is our liability to maintain.
