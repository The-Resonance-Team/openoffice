# 0009 — Provider auth is layered on top of env: config, not a replacement

`map.md`'s "Not yet specified" list asked "Provider auth: reuse opencode's OAuth or build new?" and no issue resolved it through issues #1–#6. Issue #7 answers it: `env:VAR_NAME` config references remain the explicit, scriptable path and always take priority; `openoffice auth login <provider>` is an added convenience layered on top, storing credentials in `~/.local/share/openoffice/auth.json` (mode `0600`).

Login uses a temporary, one-shot local HTTP listener for the OAuth callback — not the persistent daemon from ADR 0007. This was deliberate: auth doesn't need session state, tool execution, or SSE streaming, so tying it to the daemon's lifecycle would only add a dependency (the daemon must be running to log in) for no benefit. Providers without OAuth fall back to a prompted API key stored the same way.

## Considered options

- **OAuth-only, drop env: support**: rejected — `env:` is simpler for CI/scripted use and was already shipped in issue #2; breaking it for a new convenience feature has no upside.
- **Tie login to the daemon (issue #4)**: rejected — forces a persistent background process to exist just to run a one-time login command.
