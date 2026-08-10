# Cloud

The hosted multi-tenant service behind openoffice's "managed sign-in": orgs, teams, and roles that let an admin configure LLM providers and skills once so a non-technical member never has to. Optional — the daemon (see root `CONTEXT.md`) works fully offline with no Cloud account at all.

Code lives in `apps/cloud-api` (NestJS backend, ADR 0005) and `apps/cloud-web` (Next.js frontend); both compile against the shared `@openoffice/schema` and `@openoffice/protocol` packages (root ADR 0025). Design decisions live in `cloud/docs/adr/`.

## Language

**Org**:
The billable, top-level tenant. Owns provider credentials (via Cred Proxy), Cloud Config, Cloud Plugins, and the Analytics data collected from its members. Created at registration: the registrant's first Org is auto-created with them as Owner; an Invite is the only path into existing Orgs.
_Avoid_: account, workspace, tenant

**User**:
The person with access to Cloud: one identity per human, spanning every Org they belong to. Holds credentials (password, linked OAuth providers); is not itself part of any Org. A User is admitted into an Org as a Member (below). Not to be confused with the daemon identity — the daemon authenticates with a Daemon API Key, not as a User.
_Avoid_: account, profile, person (ambiguous between identity and membership)

**Verified email**:
A User lifecycle state, set once the EmailToken confirmation is accepted. An unverified User cannot log in and cannot accept an Invite — verification gates every entry into an Org.
_Avoid_: email confirmation, 2FA, email verified flag

**Member**:
A User's position inside one Org: the join row (orgId + userId) that carries the Role and Team. A User may be a Member of several Orgs; each membership is independent (own role, own team). Without a membership, a User sees no Org.
_Avoid_: account, user (see User), participant

**Invite**:
A pending Membership offer: one User, one Org, one Role. Accepting it creates the Member row; it can be revoked before acceptance. The carrier of the Consent disclosure at admission time.
_Avoid_: invitation email, admission

**Team**:
An optional grouping of members within an Org. A member may belong to zero or one team; an Org does not require any team to exist.
_Avoid_: group, department

**Role**:
A fixed position in the Org's access hierarchy, not an attribute policy (see ADR: RBAC not ABAC). Four values, each strictly scoped:

- **Owner** — one per Org, full control including billing and Owner transfer
- **Admin** — Org-wide management: provider config, Cloud Plugins, member/team membership
- **Team Leader** — Admin-equivalent, scoped to their own Team only: invites/removes that team's members, publishes team-scoped Cloud Plugins, sees that team's Analytics. Cloud Config stays Org-wide; Members with no Team are managed by Admin only.
- **Member** — uses Org-provided config/plugins, no management permission
  _Avoid_: permission level, access tier, ABAC policy

**Managed Sign-in**:
The member-facing entry point into an Org: authenticate once on the web (password or OAuth), and provider credentials, Cloud Config, and Cloud Plugins the Org has set up are available with no further local setup. The web session covers the browser; the daemon authenticates separately with a Daemon API Key (below).
_Avoid_: login, SSO, account linking

**Daemon API Key**:
The long-lived credential a Member generates after Managed Sign-in and pastes into their daemon once. The daemon presents it to Cloud for every request — including to the Cred Proxy — and it can be revoked from the web without affecting the web session. One Member may hold several keys (one per machine).
_Avoid_: token, session credential, device credential

**Session**:
The browser-side authenticated context that Managed Sign-in produces (JWT + refresh cookie, persisted as the `Session` row). Carries the Active Org. Revoked by logout; independent of Daemon API Keys, which authenticate the daemon, not the browser.
_Avoid_: web session (collides with root `CONTEXT.md` → Session, which is one daemon conversation — unrelated), login session

**Active Org**:
The Org a Session currently operates as — set on sign-in, changed via Org switch. A Session property, not a User property: each browser picks its own Active Org. The Daemon API Key has no Active Org; it belongs to exactly one Member.
_Avoid_: current org, default org

**Cred Proxy**:
The Org-side service holding real LLM provider API keys. A member's daemon routes provider requests through the Cred Proxy presenting its Daemon API Key; the raw provider key never reaches the member's device. Distinct from local `env:` credentials (root `CONTEXT.md` → Provider), which stay device-local as today.
_Avoid_: credential sync, key sharing, vault

**Cloud Config**:
Org-managed configuration (provider selection, defaults) a member's daemon can pull instead of setting up locally. Local config always takes precedence when both exist for the same key — Cloud Config is the fallback, not an override.
_Avoid_: cloud sync, remote config, config sync (collides with root `CONTEXT.md` → Sync, which means a second device joining the same local daemon — unrelated)

**Cloud Plugin**:
The umbrella term for any agent-extension bundle an Org publishes for its members instead of leaving them to local setup: a Skill (root `CONTEXT.md` → Skill), an MCP server configuration (root `CONTEXT.md` → MCP server), or future extension kinds. Additive: a member sees their local setup plus the Org's Cloud Plugins. Ingested via GitHub sync or direct upload. Carries a scope at publication — Org-wide (default) or Team — team-scoped plugins reach only that team.
_Avoid_: shared skill, marketplace plugin, extension (ambiguous with the daemon's own extension surface; note: root `CONTEXT.md` lists "plugin" in the avoid-lists of Tool and MCP server — this Cloud term supersedes that within the Cloud context)

**Analytics**:
One event pipeline fed by members' daemons, with permission-scoped views: an Admin/Team Leader sees their own Org's (or Team's) usage dashboard; cross-Org aggregate view is a separate, higher permission level. Not two systems — one collection mechanism, gated at read time by Role. Collects usage events only — session turns, token counts per provider, tool calls, errors — never message or file content. Retained 90 days, then purged.
_Avoid_: telemetry (see root `CONTEXT.md` for the separate, self-hosted OTLP export a member can enable independent of any Org), datalake, usage tracking

**Consent**:
Org-level, opt-out by default: the Owner/Admin's acceptance at Org setup covers all members' Analytics collection, disclosed at invite time rather than re-collected per member. A member may always opt out of their own device's collection — the member-level choice beats Org consent, mirroring Cloud Config's local-wins precedence. Distinct from the root context's self-hosted OTLP export, which needs no consent flow since it only ever leaves the member's own device to an endpoint they configured themselves.
_Avoid_: privacy policy, opt-in flow

**Appearance preference**:
A User's theme choice: `light`, `dark`, or `system`. Stored on the User row, applied client-side by the frontend. Not an Org-level setting — each User picks their own theme.
_Avoid_: theme setting, UI preference

**Notification preference**:
A User's email opt-in/out flags for transactional emails: invite received, password changed, member joined org. Three boolean columns on User, all default `true`. Not a notification system (no in-app notifications, no push) — just email delivery control.
_Avoid_: notification settings, email preferences, communication prefs

**Update preference**:
A User's opt-in/out for product update emails (changelog digest). One boolean on User (`wantsUpdates`), default `true`. Separate from notification preferences because updates are marketing-adjacent, not transactional.
_Avoid_: newsletter subscription, changelog preferences

**TOTP**:
Time-based One-Time Password for two-factor authentication. A User may enable TOTP by scanning a QR code (generated from an `otpauth://` URI) with an authenticator app. The secret is stored encrypted on the User row. Once enabled, login requires both password + TOTP code.
_Avoid_: 2FA (ambiguous — could mean SMS, email, hardware key), authenticator, MFA

**Recovery code**:
A set of one-time backup codes generated when TOTP is enabled. Each code can be used once to bypass TOTP if the authenticator device is unavailable. Stored encrypted on the User row. Regenerable; regenerating invalidates all previous codes.
_Avoid_: backup code, emergency code, fallback code
