import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes as hex — used for email tokens, invites, refresh tokens. */
export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hex of a token. Email tokens, invites and refresh secrets are all
 * high-entropy randoms, so sha256 (unsalted) is the right at-rest hash;
 * argon2 stays for passwords, which are low-entropy.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
