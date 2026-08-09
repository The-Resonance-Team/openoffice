import type { Role } from "@/generated/client";

/** The principal a Daemon API Key resolves to — same shape as the JWT user. */
export interface ApiKeyPrincipal {
  keyId: string;
  userId: string;
  memberId: string;
  orgId: string;
  role: Role;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
}
