# AGENTS.md — OpenOffice agent guide

Guide for AI agents. Full glossary: [`CONTEXT.md`](./CONTEXT.md) (root) and
[`CONTEXT-MAP.md`](./CONTEXT-MAP.md) (Cloud context). Monorepo and domain
rules: [`CLAUDE.md`](./CLAUDE.md), [`docs/agents/domain.md`](./docs/agents/domain.md).

## Code conventions

The conventions below bind `apps/cloud-api` (the NestJS service). Other
surfaces keep their own rules: `packages/core` is a deep module (import only
through a domain's root entry, see `packages/core/src/README.md`); the web
apps use their own conventions.

1. **DTO for every body / multi-param** — A handler receiving `@Body()`, or
   multiple `@Query()`/`@Param()` values, must use a DTO class with
   `class-validator` decorators (ADR 0028). Validation lives in the DTO, not
   in the service or controller.
2. **No inline/mapped types for body** — `{ x: string }`, `Omit<Dto, K>`,
   `Record<string, unknown>` as a body param bypasses `ValidationPipe` (the
   `Object` metatype is excluded from validation). For the pipe to run, the
   param must be a DTO class (it may `extends` another DTO to inherit
   metadata).
3. **`services/` folder** — A module with 2+ `*.service.ts` files must be
   placed in `module_name/services/`. DTOs stay in `module_name/dto/`.
4. **Controller→service seam** — DTOs (`@Body()`/`@Query()`) pass intact into
   the service (`service.method(dto)`), imported with `import type`; no
   field-by-field destructuring in the controller. Exceptions: service→
   service calls and transport composites (cookies + body) still use
   primitives.
5. **Barrels** — Every leaf folder with ≥2 non-test files (`dto/`,
   `services/`, `controllers/`, `common/decorators`, ...) must have an
   `index.ts` `export *`-ing all members. Cross-folder imports go through the
   target folder's barrel, never deep file paths. Never import a folder's own
   barrel from inside it. New files added to a folder must be added to its
   `index.ts` manually.
6. **God-service guideline** — Split services at ~450 lines by responsibility,
   with tests per split piece.
7. **Time handling** — All time processing (parse, arithmetic, boundary,
   relative, display) uses `date-fns` (+ `@date-fns/tz` for timezones); the
   sole exception is wire serialization (`toISOString()`). No
   `new Date(y, m, d)` constructor arithmetic. The `date-fns` dependency ships
   with the first endpoint that needs it.
8. **Uploads (deferred)** — When file uploads land: extend the built-in
   multer `FileFieldsInterceptor`, validate via an extension→MIME allowlist +
   declared-mimetype check (canonicalize to the extension's MIME), inject the
   resulting URLs into the body before `ValidationPipe` runs, and avoid
   ESM-only dependencies (`file-type` was dropped in the reference stack for
   this reason). Full standard + ADR at implementation time.
9. **Cookies** — Cookie reads at the handler level use the `@Cookies()` param
   decorator (NestJS docs pattern); add the decorator when the refresh/logout
   endpoints land. Guard/strategy reads keep using `req.cookies` directly.
10. **Remaining conventions** — see Technical Rules in `CLAUDE.md` (axios
    generics, no `data?.data as Type`, Vietnamese diacritics, Tailwind v4
    utilities) and ADR 0026 (oxlint everywhere, eslint only for Next.js apps).
