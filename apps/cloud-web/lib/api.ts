// Own DTOs against cloud-api's HTTP surface — no shared types package
// between apps/cloud-api and apps/cloud-web (same tradeoff apps/web makes
// against the daemon, see apps/web/lib/api.ts). Drift is an accepted cost.

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

function apiBase(): string {
  return process.env.NEXT_PUBLIC_CLOUD_API_URL ?? 'http://localhost:3001';
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function getMe(): Promise<{ profile: MemberProfile }> {
  return request('/auth/me');
}

export function logout(): Promise<void> {
  return request('/auth/logout', { method: 'POST' });
}

export function resendVerification(email: string): Promise<{ ok: boolean }> {
  return request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function listApiKeys(): Promise<{ keys: DaemonApiKey[] }> {
  return request('/api-keys');
}

export function createApiKey(name: string): Promise<{ key: string; orgId: string }> {
  return request('/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
}

export function revokeApiKey(id: string): Promise<{ ok: boolean }> {
  return request(`/api-keys/${id}`, { method: 'DELETE' });
}

export function createInvite(email: string, role: Role): Promise<{ ok: boolean }> {
  return request('/invites', { method: 'POST', body: JSON.stringify({ email, role }) });
}

export function oauthConnectUrl(provider: 'google' | 'github'): string {
  return `${apiBase()}/v1/auth/login/${provider}`;
}
