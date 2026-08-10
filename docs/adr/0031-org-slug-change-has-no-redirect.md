# ADR 0031 — Org slug change has no redirect

## Status

Accepted

## Context

An Org's slug is used in URLs (invite links, deep links). When an OWNER/ADMIN changes the slug, existing URLs break.

Options considered:

1. **301 redirect at the edge** — `middleware.ts` checks old slugs and redirects to new. Requires storing a mapping of old→new slugs.
2. **Redirect table in DB** — API resolves old→new slugs. More flexible but adds a lookup on every request.
3. **No redirect** — slug changes invalidate existing links. Document this as a breaking change.

## Decision

Option 3: no redirect. If an org changes its slug, old invite links and bookmarked URLs die. Document this clearly in the UI ("Changing the slug will invalidate existing invite links").

Org slug changes are rare. The complexity of a redirect system (storage, lookup, cleanup) is not justified until an org actually needs it. If it becomes a problem, add a redirect table later.

## Consequences

- **Positive:** no extra schema, no middleware overhead, no cleanup logic
- **Negative:** broken links after slug change; users must be warned
- **Reversibility:** easy to add redirects later (add a `OrgSlugRedirect` table + middleware check)
