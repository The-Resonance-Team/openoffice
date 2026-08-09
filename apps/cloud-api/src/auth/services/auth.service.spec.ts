import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { fakeDb } from '../../../test/fake-db';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from './auth.service';
import { EmailTokenService } from './email-token.service';
import { MailerService } from './mailer.service';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.type';
import type { LoginDto } from '@/auth/dto/login.dto';
import type { RegisterDto } from '@/auth/dto/register.dto';
import type { SwitchOrgDto } from '@/auth/dto/switch-org.dto';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  let db: any;
  let mailer: MailerService;

  const register = (email = 'a@x.dev', orgName = 'Acme', password = 'password123') =>
    service.register({ email, password, name: 'A', orgName } as RegisterDto, '1.2.3.4');

  const login = (dto: Partial<LoginDto> = {}) =>
    service.login({ email: 'a@x.dev', password: 'password123', ...dto } as LoginDto, '1.2.3.4');

  beforeEach(() => {
    db = fakeDb();
    mailer = new MailerService(
      new ConfigService({
        resend: { from: 'no-reply@test.dev' },
        webAppUrl: 'http://localhost:3002',
      }),
    );
    service = new AuthService(
      db as PrismaService,
      new JwtService({
        secret: 'test-secret-at-least-8',
        signOptions: { expiresIn: '15m' },
      }),
      mailer,
      new EmailTokenService(db as PrismaService, mailer),
      new OAuthService(db as PrismaService),
    );
  });

  describe('register', () => {
    it('creates user (argon2-hashed password), org with OWNER member, and issues tokens', async () => {
      const send = jest.spyOn(mailer, 'send');
      const res = await register();

      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      expect(user).toBeDefined();
      expect(user.passwordHash).not.toBe('password123');
      expect(user.passwordHash).toMatch(/^\$argon2/);
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.lastOrgId).toBe(res.profile.org.id);

      const org = await db.org.findUnique({
        where: { id: res.profile.org.id },
      });
      expect(org.slug).toBe('acme');

      const member = await db.member.findFirst({
        where: { userId: user.id },
      });
      expect(member.orgId).toBe(org.id);
      expect(member.role).toBe('OWNER');

      expect(res.accessToken).toBeTruthy();
      expect(res.refreshToken).toBeTruthy();
      const payload = new JwtService({
        secret: 'test-secret-at-least-8',
      }).verify(res.accessToken);
      expect(payload.sub).toBe(member.id);
      expect(payload.orgId).toBe(org.id);
      expect(payload.role).toBe('OWNER');

      const session = [...db._session.values()].find(
        (s: any) => s.hashedRefresh === sha256(res.refreshToken),
      );
      expect(session).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.ip).toBe('1.2.3.4');
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@x.dev',
          subject: expect.stringContaining('Verify'),
        }),
      );
    });

    it('stores the email lowercased and rejects a duplicate', async () => {
      await register('A@X.Dev', 'Acme');
      await expect(register('a@x.dev', 'Other')).rejects.toThrow(/already registered/);
      const users = [...db._user.values()].map((u: any) => u.email);
      expect(users).toEqual(['a@x.dev']);
    });

    it('disambiguates a taken org slug', async () => {
      await register('a@x.dev', 'Acme');
      const res = await register('b@x.dev', 'Acme');
      const org = await db.org.findUnique({
        where: { id: res.profile.org.id },
      });
      expect(org.slug).toBe('acme-2');
    });
  });

  describe('login', () => {
    it('blocks wrong password, unverified email, and passwordless accounts', async () => {
      await register();
      await expect(login({ password: 'wrong-pass-1' })).rejects.toThrow(
        /Invalid email or password/,
      );
      await expect(login()).rejects.toThrow(/not verified/);

      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.passwordHash = null;
      user.emailVerifiedAt = new Date();
      await expect(login()).rejects.toThrow(/Invalid email or password/);
    });

    it('issues tokens for the verified user', async () => {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.emailVerifiedAt = new Date();

      const res = await login();
      expect(res.profile.user.email).toBe('a@x.dev');
      expect(res.profile.member.role).toBe('OWNER');
      expect(res.profile.org.slug).toBe('acme');
      expect(res.refreshToken).toBeTruthy();
    });

    it('uses the last-used org when the user has several memberships', async () => {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.emailVerifiedAt = new Date();
      const second = await db.org.create({
        data: { slug: 'second', name: 'Second' },
      });
      const secondMember = await db.member.create({
        data: { orgId: second.id, userId: user.id, role: 'MEMBER' },
      });
      user.lastOrgId = second.id;

      const res = await login();
      expect(res.profile.member.id).toBe(secondMember.id);
      expect(res.profile.org.id).toBe(second.id);
    });

    it('falls back to the first membership when lastOrgId is stale', async () => {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.emailVerifiedAt = new Date();
      user.lastOrgId = 'org-gone';

      const res = await login();
      expect(res.profile.org.slug).toBe('acme');
    });
  });

  describe('refresh', () => {
    async function verifiedLogin() {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.emailVerifiedAt = new Date();
      return login();
    }

    it('rotates the refresh token and accepts only the new one', async () => {
      const first = await verifiedLogin();
      const second = await service.refresh(first.refreshToken, '1.2.3.4');

      expect(second.refreshToken).not.toBe(first.refreshToken);
      const session = [...db._session.values()].find(
        (s: any) => s.hashedRefresh === sha256(second.refreshToken),
      );
      expect(session.prevHashedRefresh).toBe(sha256(first.refreshToken));
    });

    it('revokes the session when a pre-rotation token is replayed (reuse detection)', async () => {
      const first = await verifiedLogin();
      await service.refresh(first.refreshToken, '1.2.3.4');

      await expect(service.refresh(first.refreshToken, '1.2.3.4')).rejects.toThrow(/reused/);
      const session = [...db._session.values()].find(
        (s: any) => s.prevHashedRefresh === sha256(first.refreshToken),
      );
      expect(session.revokedAt).toBeInstanceOf(Date);
    });

    it('rejects unknown and expired sessions', async () => {
      const { refreshToken } = await verifiedLogin();
      await expect(service.refresh('deadbeef', '1.2.3.4')).rejects.toThrow(/Invalid session/);

      const session = [...db._session.values()].find(
        (s: any) => s.hashedRefresh === sha256(refreshToken),
      );
      session.expiresAt = new Date(Date.now() - 1_000);
      await expect(service.refresh(refreshToken, '1.2.3.4')).rejects.toThrow(/Invalid session/);
    });
  });

  describe('logout', () => {
    it('revokes the session so refresh no longer works', async () => {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.emailVerifiedAt = new Date();
      const { refreshToken } = await login();

      await service.logout(refreshToken);
      const session = [...db._session.values()].find(
        (s: any) => s.hashedRefresh === sha256(refreshToken),
      );
      expect(session.revokedAt).toBeInstanceOf(Date);
      await expect(service.refresh(refreshToken, '1.2.3.4')).rejects.toThrow(/Invalid session/);
    });
  });

  describe('switchOrg', () => {
    it('issues tokens for another membership and remembers it as lastOrgId', async () => {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      user.emailVerifiedAt = new Date();
      const { refreshToken } = await login();
      const second = await db.org.create({
        data: { slug: 'second', name: 'Second' },
      });
      const secondMember = await db.member.create({
        data: { orgId: second.id, userId: user.id, role: 'MEMBER' },
      });

      const member = await db.member.findFirst({ where: { userId: user.id } });
      const res = await service.switchOrg(
        { memberId: secondMember.id } as SwitchOrgDto,
        member.id,
        refreshToken,
        '1.2.3.4',
      );
      expect(res.profile.org.id).toBe(second.id);
      const updated = await db.user.findUnique({ where: { id: user.id } });
      expect(updated.lastOrgId).toBe(second.id);
    });

    it('rejects switching to a membership of another user', async () => {
      await register();
      const user = await db.user.findUnique({ where: { email: 'a@x.dev' } });
      const outsider = await db.user.create({ data: { email: 'o@x.dev' } });
      const org2 = await db.org.create({ data: { slug: 'o2', name: 'O2' } });
      const otherMember = await db.member.create({
        data: { orgId: org2.id, userId: outsider.id, role: 'MEMBER' },
      });

      await db.session.create({
        data: {
          userId: user.id,
          hashedRefresh: sha256('valid-refresh'),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      await expect(
        service.switchOrg(
          { memberId: otherMember.id } as SwitchOrgDto,
          (await db.member.findFirst({ where: { userId: user.id } })).id,
          'valid-refresh',
          '1.2.3.4',
        ),
      ).rejects.toThrow(/Not a member/);
    });
  });

  describe('me', () => {
    it('returns the member profile with org, team and user', async () => {
      const res = await register();
      const profile = await service.me(res.profile.member.id);
      expect(profile.user.email).toBe('a@x.dev');
      expect(profile.org.name).toBe('Acme');
      expect(profile.team).toBeNull();
    });
  });

  describe('oauthSignIn', () => {
    it('links or creates the user, ensures a membership, and issues a session', async () => {
      const res = await service.oauthSignIn(
        'GOOGLE' as never,
        {
          providerUserId: 'g-1',
          email: 'oauth@x.dev',
          emailVerified: true,
          name: 'O',
        } as OAuthProfile,
        '1.2.3.4',
      );
      expect(res.profile.user.email).toBe('oauth@x.dev');
      expect(res.profile.user.emailVerified).toBe(true);
      expect(res.profile.member.role).toBe('OWNER');
      expect(res.refreshToken).toBeTruthy();
      expect([...db._session.values()]).toHaveLength(1);
    });
  });
});
