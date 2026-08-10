// Own DTOs against cloud-api's HTTP surface — no shared types package
// between apps/cloud-api and apps/cloud-web (same tradeoff apps/web makes
// against the daemon, see apps/web/lib/api.ts). Drift is an accepted cost.

import { api, apiBase, ApiError } from './client';

export type Role = 'OWNER' | 'ADMIN' | 'TEAM_LEADER' | 'MEMBER';

export interface MemberProfile {
  user: { id: string; email: string; name: string | null; emailVerified: boolean };
  member: { id: string; role: Role };
  org: { id: string; slug: string; name: string };
  team: { id: string; name: string } | null;
}

export interface DaemonApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

/** Owner/Admin only, per cloud-api's @Roles(OWNER, ADMIN) guard on invites — see ADR 0001. */
export function canManageOrg(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function getMe(): Promise<{ profile: MemberProfile }> {
  return api.get<{ profile: MemberProfile }>('/auth/me').then((r) => r.data);
}

export function logout(): Promise<void> {
  return api.post('/auth/logout').then(() => undefined);
}

export function resendVerification(email: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/auth/resend-verification', { email }).then((r) => r.data);
}

export function listApiKeys(): Promise<{ keys: DaemonApiKey[] }> {
  return api.get<{ keys: DaemonApiKey[] }>('/api-keys').then((r) => r.data);
}

export function createApiKey(name: string): Promise<{ key: string; orgId: string }> {
  return api.post<{ key: string; orgId: string }>('/api-keys', { name }).then((r) => r.data);
}

export function revokeApiKey(id: string): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/api-keys/${id}`).then((r) => r.data);
}

export function createInvite(email: string, role: Role): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/invites', { email, role }).then((r) => r.data);
}

export function oauthConnectUrl(provider: 'google' | 'github'): string {
  return `${apiBase()}/v1/auth/login/${provider}`;
}

export function login(email: string, password: string): Promise<{ profile: MemberProfile }> {
  return api
    .post<{ profile: MemberProfile }>('/auth/login', { email, password })
    .then((r) => r.data);
}

export function register(
  email: string,
  password: string,
  orgName: string,
  name?: string,
): Promise<{ profile: MemberProfile }> {
  return api
    .post<{ profile: MemberProfile }>('/auth/register', { email, password, orgName, name })
    .then((r) => r.data);
}

export function forgotPassword(email: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/auth/forgot-password', { email }).then((r) => r.data);
}

export function resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/auth/reset-password', { token, password }).then((r) => r.data);
}

export function verifyEmail(token: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/auth/verify-email', { token }).then((r) => r.data);
}
