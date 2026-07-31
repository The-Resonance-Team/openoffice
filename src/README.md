# src/ — deep modules

Each immediate child of `src/` (`agent/`, `config/`, `llm/`, `tool/`, `session/`, `mcp/`, `office/`, `events/`) is a **deep module**: a lot of behaviour behind a small interface. Its **entry points** are its root files — import those from outside. Everything in a subfolder (`lib/`, …) is private.

## Copy-me shape

```
src/<domain>/
  index.ts       ← an entry point (public). Import this from outside.
  client.ts      ← another entry point. A domain may expose SEVERAL.
  lib/           ← implementation: hidden from outside, free to import each other.
  tests/         ← co-located tests + fixtures (a subfolder, so private).
```

## The rules

1. **Entry-point boundary** — code outside a domain (app code or another domain) may import only that domain's entry points (its root files), never anything in its subfolders.
2. **Intra-domain freedom** — a domain's own files import each other freely.
3. **Tests through the entry points** — files under `<domain>/tests/` may import any domain's entry points and their own `tests/` fixtures, but never any domain's subfolder internals (not even their own). Integration tests across domains are fine; deep imports are not. (Tests in the root `test/` follow rule 1.)
4. **No cycles** — no dependency cycles.

## Check

```
bun run lint:boundaries
```

Runs `depcruise src` (also in the pre-commit hook). Violations are reported with the rule name that bit.

## No barrels

Public surface is _every_ root file, so expose several small entry points (`index.ts`, `client.ts`, …) instead of funnelling everything through one giant `index.ts`. Barrel files that re-export a whole subtree are discouraged — keep entry points small and hide implementation in subfolders. Adding an entry point is just adding a root file — no config change.
