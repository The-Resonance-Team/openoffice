// Session TTLs (cloud ADR 0006, EcoPick reference) — single source so the
// JWT expiry, refresh rotation and the cookie max-ages cannot drift.
export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const REFRESH_TTL_DAYS = 7;
