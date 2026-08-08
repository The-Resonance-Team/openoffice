import type { Role } from "@/generated/client";

export interface JwtPayload {
  sub: string; // memberId
  userId: string;
  orgId: string;
  role: Role;
}

export interface AuthenticatedMember {
  memberId: string;
  userId: string;
  orgId: string;
  role: Role;
}
