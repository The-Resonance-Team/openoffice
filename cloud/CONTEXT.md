# Cloud

The hosted multi-tenant service behind openoffice's "managed sign-in": orgs, teams, and roles that let an admin configure LLM providers and skills once so a non-technical member never has to. Optional — the daemon (see root `CONTEXT.md`) works fully offline with no Cloud account at all.

## Language

**Org**:
The billable, top-level tenant. Owns provider credentials (via Cred Proxy), Cloud Config, Cloud Skills, and the Analytics data collected from its members.
_Avoid_: account, workspace, tenant

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
The member-facing entry point into an Org: authenticate once (via OpenAuth.js), and provider credentials, Cloud Config, and Cloud Skills the Org has set up are available with no further local setup.
_Avoid_: login, SSO, account linking

**Cred Proxy**:
The Org-side service holding real LLM provider API keys. A member's daemon routes provider requests through the Cred Proxy using its own session credential; the raw provider key never reaches the member's device. Distinct from local `env:` credentials (root `CONTEXT.md` → Provider), which stay device-local as today.
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
