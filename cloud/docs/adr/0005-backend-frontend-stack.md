# 0005 — Cloud backend is NestJS + Postgres/Drizzle + OpenAuth.js on Docker; frontend is Next.js + Chart.js

We looked at opencode's own hosted console (same problem: accounts, billing, auth, usage dashboards) which uses SST v3 + Cloudflare Workers + Postgres/Drizzle + OpenAuth.js on the backend, and SolidJS/solid-start + Vite + Chart.js on the frontend. We're adapting rather than mirroring: NestJS instead of Workers-shaped functions (a persistent Node server suits this better than edge functions, and matches the team's existing NestJS/Next.js/axios conventions), Next.js instead of SolidJS (larger hiring pool, same axios-generic-interceptor API client pattern used elsewhere), deployed via Docker rather than SST/Cloudflare. Postgres, Drizzle ORM (already this repo's ORM per root ADR 0005 — "Drizzle for session storage"), OpenAuth.js, and Chart.js carry over unchanged — all framework-agnostic, all already proven for this exact problem.

## Considered options

- Mirror opencode exactly (SST + Cloudflare Workers + SolidJS) — rejected: no existing team experience with Workers or Solid, and Cloudflare Workers' non-Node runtime doesn't suit NestJS.
- Bun-native (Hono/Elysia on Bun, roll auth) — rejected: throws away OpenAuth.js and Chart.js for no concrete benefit; Bun's role stays limited to the existing daemon/CLI.
