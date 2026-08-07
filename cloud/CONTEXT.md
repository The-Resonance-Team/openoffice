# Cloud

The hosted multi-tenant service behind openoffice's "managed sign-in": orgs, teams, and roles that let an admin configure LLM providers and skills once so a non-technical member never has to. Optional — the daemon (see root `CONTEXT.md`) works fully offline with no Cloud account at all.

Code lives in `apps/cloud-api` (NestJS backend, ADR 0005) and `apps/cloud-web` (Next.js frontend); both compile against the shared `@openoffice/schema` and `@openoffice/protocol` packages (root ADR 0025). Design decisions live in `cloud/docs/adr/`.

## Language

**Org**:
The billable, top-level tenant. Owns provider credentials (via Cred Proxy), Cloud Config, Cloud Skills, and the Analytics data collected from its members.
_Avoid_: account, workspace, tenant

**User**:
The person with access to Cloud: one identity per human, spanning every Org they belong to. Holds credentials (password, linked OAuth providers); is not itself part of any Org. A User is admitted into an Org as a Member (below). Not to be confused with the daemon identity — the daemon authenticates with a Daemon API Key, not as a User.
_Avoid_: account, profile, person (ambiguous between identity and membership)

**Member**:
A User's position inside one Org: the join row (orgId + userId) that carries the Role and Team. A User may be a Member of several Orgs; each membership is independent (own role, own team). Without a membership, a User sees no Org.
_Avoid_: account, user (see User), participant

**Team**:
An optional grouping of members within an Org. A member may belong to zero or one team; an Org does not require any team to exist.
_Avoid_: group, department

**Role**:
A fixed position in the Org's access hierarchy, not an attribute policy (see ADR: RBAC not ABAC). Four values, each strictly scoped:

- **Owner** — one per Org, full control including billing and Owner transfer
- **Admin** — Org-wide management: provider config, Cloud Skills, member/team membership
- **Team Leader** — Admin-equivalent permissions, scoped to their own Team only
- **Member** — uses Org-provided config/skills, no management permission
  _Avoid_: permission level, access tier, ABAC policy

**Managed Sign-in**:
The member-facing entry point into an Org: authenticate once on the web (password or OAuth), and provider credentials, Cloud Config, and Cloud Skills the Org has set up are available with no further local setup. The web session covers the browser; the daemon authenticates separately with a Daemon API Key (below).
_Avoid_: login, SSO, account linking

**Daemon API Key**:
The long-lived credential a Member generates after Managed Sign-in and pastes into their daemon once. The daemon presents it to Cloud for every request — including to the Cred Proxy — and it can be revoked from the web without affecting the web session. One Member may hold several keys (one per machine).
_Avoid_: token, session credential, device credential

**Cred Proxy**:
The Org-side service holding real LLM provider API keys. A member's daemon routes provider requests through the Cred Proxy presenting its Daemon API Key; the raw provider key never reaches the member's device. Distinct from local `env:` credentials (root `CONTEXT.md` → Provider), which stay device-local as today.
_Avoid_: credential sync, key sharing, vault

**Cloud Config**:
Org-managed configuration (provider selection, defaults) a member's daemon can pull instead of setting up locally. Local config always takes precedence when both exist for the same key — Cloud Config is the fallback, not an override.
_Avoid_: cloud sync, remote config, config sync (collides with root `CONTEXT.md` → Sync, which means a second device joining the same local daemon — unrelated)

**Cloud Skill**:
A Skill (root `CONTEXT.md` → Skill) published by an Org Admin/Team Leader instead of authored as a local `.md` file. Additive: a member sees both their local skills and their Org's Cloud Skills. Ingested via GitHub sync or direct upload.
_Avoid_: shared skill, marketplace skill

**Analytics**:
One event pipeline fed by members' daemons, with permission-scoped views: an Admin/Team Leader sees their own Org's (or Team's) usage dashboard; cross-Org aggregate view is a separate, higher permission level. Not two systems — one collection mechanism, gated at read time by Role.
_Avoid_: telemetry (see root `CONTEXT.md` for the separate, self-hosted OTLP export a member can enable independent of any Org), datalake, usage tracking

**Consent**:
Org-level, opt-out by default: the Owner/Admin's acceptance at Org setup covers all members' Analytics collection, disclosed at invite time rather than re-collected per member. Distinct from the root context's self-hosted OTLP export, which needs no consent flow since it only ever leaves the member's own device to an endpoint they configured themselves.
_Avoid_: privacy policy, opt-in flow
