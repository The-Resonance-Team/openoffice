import { UnauthorizedException } from '@nestjs/common';
import { Provider } from '@/generated/client';
import { fakeDb } from '../../../test/fake-db';
import { PrismaService } from '@/prisma/prisma.service';
import { OAuthAccountRepo, UserRepo, MemberRepo, OrgRepo } from '@/auth/repo';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let db: any;

  const profile = (overrides: Record<string, unknown> = {}) => ({
    providerUserId: 'g-123',
    email: 'a@x.dev',
    name: 'A',
    emailVerified: true,
    ...overrides,
  });

  beforeEach(() => {
    db = fakeDb();
    const oauthAccounts = new OAuthAccountRepo(db as PrismaService);
    const users = new UserRepo(db as PrismaService);
    const members = new MemberRepo(db as PrismaService);
    const orgs = new OrgRepo(db as PrismaService);
    service = new OAuthService(db as PrismaService, oauthAccounts, users, members, orgs);
  });

  it('creates a user on first sign-in with a verified email', async () => {
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user.email).toBe('a@x.dev');
    expect(user.passwordHash).toBeNull();
    const link = await db.oAuthAccount.findFirst({
      where: { provider: 'GOOGLE', providerUserId: 'g-123' },
    });
    expect(link.userId).toBe(userId);
  });

  it('auto-links to an existing password user and inherits provider verification', async () => {
    const existing = await db.user.create({
      data: { id: 'u1', email: 'a@x.dev', passwordHash: '$argon2$x' },
    });
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    expect(userId).toBe(existing.id);
    const link = await db.oAuthAccount.findFirst({
      where: { provider: 'GOOGLE', providerUserId: 'g-123' },
    });
    expect(link.userId).toBe('u1');
    // provider-verified email = verified (ADR 0006): the linked unverified
    // password account can now log in with its password
    expect((await db.user.findUnique({ where: { id: 'u1' } })).emailVerifiedAt).toBeInstanceOf(
      Date,
    );
  });

  it('resolves the same provider account to the same user across emails', async () => {
    const first = await service.linkOrCreateUser(Provider.GITHUB, profile());
    const second = await service.linkOrCreateUser(
      Provider.GITHUB,
      profile({ email: 'changed@x.dev' }),
    );
    expect(second).toBe(first);
  });

  it('rejects an unverified or missing email', async () => {
    await expect(
      service.linkOrCreateUser(Provider.GITHUB, profile({ emailVerified: false })),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.linkOrCreateUser(Provider.GITHUB, profile({ email: undefined })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('ensureMembership gives a memberless user a personal org as OWNER', async () => {
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    await service.ensureMembership(userId);
    const members = await db.member.findMany({ where: { userId } });
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('OWNER');
    const org = await db.org.findUnique({ where: { id: members[0].orgId } });
    expect(org.slug).toBe('a');
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user.lastOrgId).toBe(org.id);
  });

  it('ensureMembership leaves existing memberships alone', async () => {
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    await db.org.create({ data: { id: 'o1', slug: 'acme', name: 'Acme' } });
    await db.member.create({
      data: { orgId: 'o1', userId, role: 'MEMBER' },
    });
    await service.ensureMembership(userId);
    const members = await db.member.findMany({ where: { userId } });
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('MEMBER');
  });
});
