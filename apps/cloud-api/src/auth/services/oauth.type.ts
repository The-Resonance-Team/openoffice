/** Normalized provider profile (strategies map passport profiles to this). */
export interface OAuthProfile {
  providerUserId: string;
  email?: string;
  name?: string;
  /** Verified by the provider itself — the auto-link trust anchor. */
  emailVerified?: boolean;
}
