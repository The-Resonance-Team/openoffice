# 0032 — RHF + zod + TanStack Query as the web form/data-fetching standard

## Status

Accepted.

## Context

The two Next.js web apps (`apps/web`, `apps/cloud-web`) grew their UIs by hand: forms were `useState`-per-field with native `required`/`minLength` attributes and a single string error, and data fetching was a mix of raw `fetch` (cloud-web's `request<T>` wrapper, cookie auth) and axios (web's `client.ts`, Basic auth). Validation was not centralized anywhere — each form duplicated inline checks, and nothing mirrored the class-validator DTO rules that `apps/cloud-api` enforces at its trust boundary (ADR 0028), so client and server rules drifted independently.

`@tanstack/react-query` was already installed and partially used in both apps (queries in `cloud-web/lib/use-api.ts`, bare `useQuery`/`useMutation` in `web` components), so the migration is an adoption, not an introduction.

## Decision

The web apps standardize on React Hook Form + zod + axios + TanStack Query:

- **Forms** use `react-hook-form` with `zodResolver`; each form's validation lives in a zod schema (`lib/form-schemas.ts` per app) whose rules mirror the matching `cloud-api` DTO — client and server speak the same contract.
- **Transport** is axios (`lib/client.ts` per app). Cloud-web's instance sends cookies (`withCredentials`) and normalizes errors into the existing `ApiError`; web's instance keeps its sessionStorage Basic-auth interceptor. Both throw typed errors; the `{ data: T }` envelope unwrap rule from the reference stack does not apply — neither daemon nor cloud-api returns an envelope.
- **Data fetching** goes through TanStack Query: queries via `useQuery`, writes via `useMutation` with `invalidateQueries` on success, query keys via a minimal key factory where an app shares keys across hooks (cloud-web); apps with a handful of keys keep flat keys (web). Page-level 401 handling is preserved (no global redirect interceptor).
- **SSE streaming is the one exception**: `streamSession` stays on raw `fetch` because browser axios is XHR-based with no streaming reader and EventSource cannot set an Authorization header. This exception is permanent, not a debt marker.
- Chat text inputs (`Composer`, `ChatPanel`) are not data-entry forms and do not use RHF.
- No test runner is added to the web apps; the zod schemas duplicate DTO rules and are verified by integration, not unit tests.

## Consequences

- One validation culture per seam: zod in browser forms, class-validator at the HTTP boundary (ADR 0028), zod for config — consistent with the repo's existing split.
- Forms lose per-form `loading`/`error` state (mutations own it) and gain per-field errors; server rejections surface as a root-level error.
- The web apps' fetch/axios split is gone: only `streamSession` remains on fetch.
- Future forms and endpoints follow this pattern by default; the SSE-on-fetch carve-out should not be re-litigated without revisiting this ADR.
