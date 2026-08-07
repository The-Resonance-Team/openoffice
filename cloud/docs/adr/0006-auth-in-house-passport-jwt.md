# 0006 — Cloud auth is in-house NestJS + Passport + JWT, not OpenAuth.js

Auth design session (2026-08) decided the Cloud context authenticates Users with a self-hosted NestJS stack — Passport strategies (password, Google, GitHub), 15-minute access JWTs + rotating 7-day refresh tokens (sha256-hashed in `Session` rows — refresh tokens and keys are high-entropy randoms where argon2 would be needless — with reuse detection, httpOnly cookies), email verification with password reset, auto-linked OAuth identities, and a separate permanent **Daemon API Key** (sha256-hashed, revocable, one per machine, bound to exactly one Org) for headless daemon access. argon2 remains for passwords only. Pattern is modeled on the EcoPick platform's proven implementation (`apps/api/src/domain/people/auth` in `Ecopick-Platform`), whose sessions/refresh/cookie design we adapted; ADR 0005's OpenAuth.js plan was reversed.

Identity model: **User** (global person: email unique, password hash, verified flag, linked OAuth accounts) separate from **Member** (org-scoped join: orgId, teamId, Role) — a person may belong to several Orgs, and each web session binds to exactly one Org. Role enum is `OWNER | ADMIN | TEAM_LEADER | MEMBER` (glossary in `cloud/CONTEXT.md`; the earlier `ADMIN|TEAM_ADMIN|MEMBER` schema enum was a bug). One Org per session keeps the JWT payload (`sub: memberId, userId, orgId, role` — userId rides along for user-scoped actions like API-key management and invite acceptance) and every guard check simple, and keeps Cred Proxy routing Org-scoped.

Provisioning is self-serve: signup creates a new Org with the signer as Owner; additional members join via 7-day one-time email invites (which also carry the Analytics consent disclosure). OAuth collisions auto-link on verified provider email. Roles ride in the JWT for web sessions (EcoPick pattern); Daemon API Keys resolve the Member's role from the DB per request since keys carry no claims.

## Considered options

- **OpenAuth.js** (original ADR 0005 plan) — rejected: heavy third-party auth dependency where the product needs email/password + two OAuth providers + a custom headless key mechanism; EcoPick proved the in-house stack at comparable scale, and Cloud's JWT foundation (strategy, guards, `@Public()`) was already built.
- **Magic links / passwordless** — rejected: needs email delivery on every sign-in, worse than a password for a long-lived product account.
- **OAuth-only (Google/GitHub, no password)** — rejected: non-technical members may have neither provider account; password is the universal fallback.

## Consequences

- The auth surface is our liability: session rotation, hashing, rate limiting (`@nestjs/throttler`), and OAuth strategy maintenance are on us — no provider to absorb CVE fallout.
- Email delivery becomes required infrastructure (verification, reset, invites) — first real transactional-email dependency.
- Daemon integration: the daemon (root context) needs an `auth login`-style flow to paste a Daemon API Key; Cred Proxy validation switches to key-based.
- Prisma schema changes: new `User`, `OAuthAccount`, `Session`, `ApiKey`, `VerificationToken`/`PasswordResetToken` (or one email-token table), `Member` gains `userId`; `Role` enum values fixed.
