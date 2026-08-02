# 0012 — Sync reuses issue #14's token auth; no per-device identity

Issue #18 (sync) requires widening the daemon's network bind beyond loopback (issue #14's default) so a second device can reach it. Rather than building per-device identity, pairing, or a device registry, sync reuses the same per-instance bearer token from issue #14 unchanged: any client presenting the token can act as a full client, indistinguishable from any other.

This means the token is the _only_ boundary once `daemon.bind` is widened — anyone on the reachable network segment who obtains it can drive the session, not just the user's own second device. That is a deliberate, documented trade-off, not an oversight: building real device identity (pairing flow, per-device tokens, revocation) is meaningfully more work for a local-first, single-user tool where the realistic threat is "someone else on my home network," not a multi-tenant environment. If openoffice ever needs actual multi-tenant or multi-user access control, this decision should be revisited alongside issue #12's auth (they'd share a real identity model at that point).

## Considered options

- **Per-device tokens with a pairing flow (QR code, approval prompt)**: rejected for v1 — meaningfully more implementation for a threat model (shared local network) that a single strong token already covers reasonably well. Revisit if `daemon.bind` usage in practice shows this is insufficient.
