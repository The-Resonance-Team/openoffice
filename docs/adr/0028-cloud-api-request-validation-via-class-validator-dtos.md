# 0028 — cloud-api request validation via class-validator DTOs

## Status

Accepted.

## Context

`apps/cloud-api` bootstraps a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) in `src/main.ts`, and `class-validator`/`class-transformer` are installed — but no handler yet takes a validated DTO param, so the pipe has never had a class to act on. The repo's validation lingua franca elsewhere is zod (env config in `src/config/configuration.ts`, plus every other package), which raises the question: which culture do HTTP request bodies follow?

The reference NestJS stack (Ecopick `apps/api`, PR #206 "code-quality pass") codified the answer after a production incident: a `Record<string, unknown>` body was passed straight into `prisma.trainer.update` — any model field became mass-assignable through a public admin endpoint. NestJS's `ValidationPipe` only validates params whose metatype is a class; inline object types (`{ x: string }`), mapped types (`Omit<Dto, K>`, `Pick<Dto, K>`), and `Record<string, unknown>` all degrade to the `Object` metatype and are silently skipped — the pipe is a no-op exactly where it matters most.

## Decision

HTTP request validation in `apps/cloud-api` uses `class-validator` DTO classes:

- Every handler receiving `@Body()`, or multiple `@Query()`/`@Param()` values, takes a DTO class decorated with `class-validator` rules; validation lives in the DTO, never in the service or controller.
- Inline, mapped, and `Record`-typed body params are banned — they bypass the pipe. A DTO may `extends` another DTO to inherit metadata.
- DTOs pass intact into the service (`service.method(dto)`), imported with `import type`; no field-by-field destructuring at the controller seam. Exceptions: service→service calls and transport composites (cookies + body).
- zod stays for environment and domain configuration (its current roles). Two validation stacks coexist by seam: HTTP trust boundary = class-validator, everything else = zod.
- Uploads (a deferred feature, see AGENTS.md) inject URLs into the body before the pipe runs, so DTOs keep a URL-based shape.

## Consequences

- Unknown body properties produce 400s (`forbidNonWhitelisted`) — an intentional strictness the frontend must match.
- Each new endpoint pays a small DTO tax up front; the pipe finally does what it is configured to do.
- Mass-assignment holes are closed by construction: a DTO is the whitelist.
- Two validation libraries in one package is a deliberate split, not drift — future readers should not "unify" them without revisiting this ADR.
