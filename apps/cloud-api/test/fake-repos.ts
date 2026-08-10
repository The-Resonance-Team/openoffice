import type {
  ApiKeyRepo,
  EmailTokenRepo,
  InviteRepo,
  MemberRepo,
  OAuthAccountRepo,
  OrgRepo,
  SessionRepo,
  TeamRepo,
  UserRepo,
} from '@/auth/repo';
import { Role } from '@/generated/client';

/**
 * Object-literal repo fakes (team rule: specs fake the repo, never Prisma
 * call shapes). Backed by in-memory maps with real equality semantics for
 * the scalar queries the services issue; access the raw stores via `maps`
 * when a test needs to seed or mutate state directly.
 */

type AnyMap = Map<string, any>;

// Public keys only — repo classes carry private fields, so object literals
// are typed against this mapped type (contextual typing) and cast at the
// boundary (team rule #19: fake repos by casting the object literal).
type Public<T> = { [K in keyof T]: T[K] };

const eq = (where: Record<string, unknown> | undefined, row: any): boolean =>
  Object.entries(where ?? {}).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('not' in v) return row[k] !== v.not;
      return Object.entries(v).every(([ck, cv]) => row[ck] === cv);
    }
    return row[k] === v;
  });

let seq = 0;
const nid = (p: string): string => `${p}${++seq}`;

function mapStore(map: AnyMap) {
  const row = (data: any) => ({
    id: nid('r'),
    createdAt: new Date(),
    usedAt: null,
    revokedAt: null,
    emailVerifiedAt: null,
    lastOrgId: null,
    teamId: null,
    prevHashedRefresh: null,
    name: null,
    passwordHash: null,
    totpSecret: null,
    totpEnabledAt: null,
    recoveryCodes: null,
    theme: 'system',
    inviteEmail: true,
    passwordChangeEmail: true,
    memberJoinEmail: true,
    wantsUpdates: true,
    ...data,
  });
  return {
    create: async (data: any) => {
      const r = row(data);
      map.set(r.id, r);
      return r;
    },
    findUnique: async ({ where }: any) => [...map.values()].find((r) => eq(where, r)) ?? null,
    findFirst: async ({ where }: any) => [...map.values()].find((r) => eq(where, r)) ?? null,
    findMany: async ({ where }: any = {}) => [...map.values()].filter((r) => eq(where, r)),
    count: async ({ where }: any = {}) => [...map.values()].filter((r) => eq(where, r)).length,
    update: async ({ where, data }: any) => {
      const r = [...map.values()].find((x) => eq(where, x));
      if (!r) throw new Error('fake: update target not found');
      Object.assign(r, data);
      return r;
    },
    updateMany: async ({ where, data }: any) => {
      const targets = [...map.values()].filter((r) => eq(where, r));
      for (const r of targets) Object.assign(r, data);
      return { count: targets.length };
    },
    delete: async ({ where }: any) => {
      const r = [...map.values()].find((x) => eq(where, x));
      if (!r) throw new Error('fake: delete target not found');
      map.delete(r.id);
      return r;
    },
  };
}

export interface FakeRepos {
  users: UserRepo;
  members: MemberRepo;
  orgs: OrgRepo;
  teams: TeamRepo;
  sessions: SessionRepo;
  apiKeys: ApiKeyRepo;
  invites: InviteRepo;
  emailTokens: EmailTokenRepo;
  oauthAccounts: OAuthAccountRepo;
  maps: {
    user: AnyMap;
    org: AnyMap;
    team: AnyMap;
    member: AnyMap;
    session: AnyMap;
    apiKey: AnyMap;
    invite: AnyMap;
    emailToken: AnyMap;
    oAuthAccount: AnyMap;
  };
}

export function makeFakeRepos(): FakeRepos {
  const maps: FakeRepos['maps'] = {
    user: new Map(),
    org: new Map(),
    team: new Map(),
    member: new Map(),
    session: new Map(),
    apiKey: new Map(),
    invite: new Map(),
    emailToken: new Map(),
    oAuthAccount: new Map(),
  };
  const user = mapStore(maps.user);
  const org = mapStore(maps.org);
  const team = mapStore(maps.team);
  const member = mapStore(maps.member);
  const session = mapStore(maps.session);
  const apiKey = mapStore(maps.apiKey);
  const invite = mapStore(maps.invite);
  const emailToken = mapStore(maps.emailToken);
  const oAuthAccount = mapStore(maps.oAuthAccount);

  const withMemberRels = (r: any) =>
    r && {
      ...r,
      user: r.userId ? (maps.user.get(r.userId) ?? null) : null,
      org: r.orgId ? (maps.org.get(r.orgId) ?? null) : null,
      team: r.teamId ? (maps.team.get(r.teamId) ?? null) : null,
    };
  const membersOf = (teamId: string) =>
    [...maps.member.values()].filter((m) => m.teamId === teamId);

  const users: Public<UserRepo> = {
    findById: (id) => user.findUnique({ where: { id } }),
    findByEmail: (email) => user.findUnique({ where: { email } }),
    create: (data) => user.create(data),
    setName: (id, name) => user.update({ where: { id }, data: { name } }),
    setPassword: (id, passwordHash) => user.update({ where: { id }, data: { passwordHash } }),
    setLastOrg: (id, orgId) => user.update({ where: { id }, data: { lastOrgId: orgId } }),
    markVerified: (id) => user.update({ where: { id }, data: { emailVerifiedAt: new Date() } }),
    setPasswordAndVerified: (id, passwordHash) =>
      user.update({ where: { id }, data: { passwordHash, emailVerifiedAt: new Date() } }),
    setTheme: (id, theme) => user.update({ where: { id }, data: { theme } }),
    setNotificationPrefs: (id, data) => user.update({ where: { id }, data }),
    setWantsUpdates: (id, wantsUpdates) => user.update({ where: { id }, data: { wantsUpdates } }),
    setTotpSecret: (id, secret) => user.update({ where: { id }, data: { totpSecret: secret } }),
    enableTotp: (id, data) =>
      user.update({
        where: { id },
        data: { totpEnabledAt: data.enabledAt, recoveryCodes: data.recoveryCodes },
      }),
    clearTotp: (id) =>
      user.update({
        where: { id },
        data: { totpSecret: null, totpEnabledAt: null, recoveryCodes: null },
      }),
    setRecoveryCodes: (id, recoveryCodes) =>
      user.update({ where: { id }, data: { recoveryCodes } }),
    delete: (id) => user.delete({ where: { id } }),
    findWithMemberships: async (id) => {
      const u = await user.findUnique({ where: { id } });
      if (!u) return null;
      const memberships = [...maps.member.values()]
        .filter((m) => m.userId === id)
        .map(withMemberRels);
      return { ...u, memberships };
    },
    createWithOrgMembership: async (data) => {
      const u = await user.create({
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
      });
      const o = await org.create({ slug: data.slug, name: data.orgName });
      const m = await member.create({
        orgId: o.id,
        userId: u.id,
        name: data.name,
        role: Role.OWNER,
      });
      await user.update({ where: { id: u.id }, data: { lastOrgId: o.id } });
      return { memberId: m.id, userId: u.id };
    },
  };

  const members: Public<MemberRepo> = {
    findById: async (id) => withMemberRels(await member.findUnique({ where: { id } })),
    findByOrgAndUser: async (orgId, userId) =>
      withMemberRels(await member.findFirst({ where: { orgId, userId } })),
    findByUserId: async (userId) =>
      (await member.findMany({ where: { userId } })).map(withMemberRels),
    listByOrg: async (orgId) =>
      (await member.findMany({ where: { orgId } })).map((r) => ({
        ...r,
        user: r.userId ? (maps.user.get(r.userId) ?? null) : null,
        team: r.teamId ? (maps.team.get(r.teamId) ?? null) : null,
      })),
    create: (data) => member.create(data),
    changeRole: (id, role) => member.update({ where: { id }, data: { role } }),
    assignTeam: (id, teamId) => member.update({ where: { id }, data: { teamId } }),
    clearTeam: (id) => member.update({ where: { id }, data: { teamId: null } }),
    delete: (id) => member.delete({ where: { id } }),
    countByOrgAndRole: (orgId, role) => member.count({ where: { orgId, role } }),
    clearTeamForAll: (teamId) => member.updateMany({ where: { teamId }, data: { teamId: null } }),
  };

  const orgs: Public<OrgRepo> = {
    findById: (id) => org.findUnique({ where: { id } }),
    findBySlug: (slug) => org.findUnique({ where: { slug } }),
    create: (data) => org.create(data),
    rename: (id, name) => org.update({ where: { id }, data: { name } }),
    changeSlug: (id, slug) => org.update({ where: { id }, data: { slug } }),
    delete: (id) => org.delete({ where: { id } }),
    generateUniqueSlug: async (name: string) => {
      const base =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
          .slice(0, 40) || 'org';
      let slug = base;
      for (let i = 2; i <= 10; i++) {
        if (!(await org.findUnique({ where: { slug } }))) return slug;
        slug = `${base}-${i}`;
      }
      return `${base}-${Date.now().toString(36)}`;
    },
    createPersonalOrgForUser: async (data) => {
      const o = await org.create({ slug: data.slug, name: data.name });
      await member.create({ orgId: o.id, userId: data.userId, role: Role.OWNER });
      await user.update({ where: { id: data.userId }, data: { lastOrgId: o.id } });
      return o.id;
    },
  };

  const teams: Public<TeamRepo> = {
    findById: async (id) => {
      const t = await team.findUnique({ where: { id } });
      return t ? { ...t, members: membersOf(id) } : null;
    },
    findByOrgAndName: (orgId, name) => team.findFirst({ where: { orgId, name } }),
    listByOrg: async (orgId) =>
      (await team.findMany({ where: { orgId } })).map((t) => ({ ...t, members: membersOf(t.id) })),
    create: (data) => team.create(data),
    rename: (id, name) => team.update({ where: { id }, data: { name } }),
    delete: (id) => team.delete({ where: { id } }),
  };

  const sessions: Public<SessionRepo> = {
    findById: (id) => session.findUnique({ where: { id } }),
    findByRefreshHash: (hashedRefresh) =>
      session.findFirst({ where: { hashedRefresh, revokedAt: null } }),
    findActiveByUserId: async (userId) => {
      const rows = await session.findMany({ where: { userId, revokedAt: null } });
      return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    findByPrevRefreshHash: (hashedRefresh) =>
      session.findFirst({ where: { prevHashedRefresh: hashedRefresh, revokedAt: null } }),
    create: (data) => session.create(data),
    rotate: (id, data) =>
      session.update({
        where: { id },
        data: {
          hashedRefresh: data.hashedRefresh,
          prevHashedRefresh: data.prevHashedRefresh,
          expiresAt: data.expiresAt,
          ip: data.ip,
        },
      }),
    revoke: (id) => session.update({ where: { id }, data: { revokedAt: new Date() } }),
    revokeByRefreshHash: (hashedRefresh) =>
      session.updateMany({ where: { hashedRefresh }, data: { revokedAt: new Date() } }),
    revokeAllOthers: (userId, currentSessionId) =>
      session.updateMany({
        where: { userId, id: { not: currentSessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
  };

  const apiKeys: Public<ApiKeyRepo> = {
    findById: (id) => apiKey.findUnique({ where: { id } }),
    findByKeyHash: (keyHash) => apiKey.findUnique({ where: { keyHash } }),
    listByUserAndOrg: (userId, orgId) =>
      apiKey.findMany({ where: { userId, orgId, revokedAt: null } }),
    create: (data) => apiKey.create(data),
    revokeScoped: (userId, orgId, keyId) =>
      apiKey.updateMany({
        where: { id: keyId, userId, orgId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
  };

  const invites: Public<InviteRepo> = {
    findById: (id) => invite.findUnique({ where: { id } }),
    findByTokenHash: (tokenHash) => invite.findFirst({ where: { tokenHash, usedAt: null } }),
    listByOrg: (orgId) => invite.findMany({ where: { orgId, usedAt: null } }),
    create: (data) => invite.create(data),
    markUsed: (id) => invite.update({ where: { id }, data: { usedAt: new Date() } }),
    reissue: (id, data) => invite.update({ where: { id }, data }),
  };

  const emailTokens: Public<EmailTokenRepo> = {
    findByTokenHash: (tokenHash) => emailToken.findFirst({ where: { tokenHash, usedAt: null } }),
    findValidToken: (userId, type) =>
      emailToken.findFirst({ where: { userId, type, usedAt: null } }),
    create: (data) => emailToken.create(data),
    markUsed: (id) => emailToken.update({ where: { id }, data: { usedAt: new Date() } }),
    markUsedMany: (userId, type) =>
      emailToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: new Date() },
      }),
  };

  const oauthAccounts: Public<OAuthAccountRepo> = {
    findByProviderAndUserId: async (provider, providerUserId) => {
      const r = await oAuthAccount.findFirst({ where: { provider, providerUserId } });
      return r ? { ...r, user: r.userId ? (maps.user.get(r.userId) ?? null) : null } : null;
    },
    findByUserId: (userId) => oAuthAccount.findMany({ where: { userId } }),
    create: (data) => oAuthAccount.create(data),
  };

  return {
    users: users as unknown as UserRepo,
    members: members as unknown as MemberRepo,
    orgs: orgs as unknown as OrgRepo,
    teams: teams as unknown as TeamRepo,
    sessions: sessions as unknown as SessionRepo,
    apiKeys: apiKeys as unknown as ApiKeyRepo,
    invites: invites as unknown as InviteRepo,
    emailTokens: emailTokens as unknown as EmailTokenRepo,
    oauthAccounts: oauthAccounts as unknown as OAuthAccountRepo,
    maps,
  };
}
