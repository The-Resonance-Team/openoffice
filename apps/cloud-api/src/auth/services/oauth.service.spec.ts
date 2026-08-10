import { UnauthorizedException } from '@nestjs/common';
import { Provider } from '@/generated/client';
import { makeFakeRepos } from '../../../test/fake-repos';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let maps: ReturnType<typeof makeFakeRepos>['maps'];

  const profile = (overrides: Record<string, unknown> = {}) => ({
    providerUserId: 'g-123',
    email: 'a@x.dev',
    name: 'A',
    emailVerified: true,
    ...overrides,
  });

  beforeEach(() => {
    const repos = makeFakeRepos();
    maps = repos.maps;
    service = new OAuthService(repos.oauthAccounts, repos.users, repos.members, repos.orgs);
  });

  it('creates a user on first sign-in with a verified email', async () => {
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    const user = maps.user.get(userId);
    expect(user.email).toBe('a@x.dev');
    expect(user.passwordHash).toBeNull();
    const link = [...maps.oAuthAccount.values()].find(
      (r) => r.provider === 'GOOGLE' && r.providerUserId === 'g-123',
    );
    expect(link.userId).toBe(userId);
  });

  it('auto-links to an existing password user and inherits provider verification', async () => {
    maps.user.set('u1', { id: 'u1', email: 'a@x.dev', passwordHash: '$argon2$x' });
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    expect(userId).toBe('u1');
    const link = [...maps.oAuthAccount.values()].find(
      (r) => r.provider === 'GOOGLE' && r.providerUserId === 'g-123',
    );
    expect(link.userId).toBe('u1');
    // provider-verified email = verified (ADR 0006): the linked unverified
    // password account can now log in with its password
    expect(maps.user.get('u1').emailVerifiedAt).toBeInstanceOf(Date);
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
    const members = [...maps.member.values()].filter((m) => m.userId === userId);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('OWNER');
    const org = maps.org.get(members[0].orgId);
    expect(org.slug).toBe('a');
    expect(maps.user.get(userId).lastOrgId).toBe(org.id);
  });

  it('ensureMembership leaves existing memberships alone', async () => {
    const userId = await service.linkOrCreateUser(Provider.GOOGLE, profile());
    maps.org.set('o1', { id: 'o1', slug: 'acme', name: 'Acme' });
    maps.member.set('m1', { id: 'm1', orgId: 'o1', userId, role: 'MEMBER', teamId: null });
    await service.ensureMembership(userId);
    const members = [...maps.member.values()].filter((m) => m.userId === userId);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('MEMBER');
  });
});
