import type { Role } from '@/generated/client';

export interface MemberProfile {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
  };
  member: { id: string; role: Role };
  org: { id: string; slug: string; name: string };
  team: { id: string; name: string } | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  profile: MemberProfile;
}

/** A membership row joined with its org/team/user (AuthService's session shape). */
export interface Membership {
  id: string;
  orgId: string;
  role: Role;
  org: { id: string; slug: string; name: string };
  team: { id: string; name: string } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerifiedAt: Date | null;
  };
}
