import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { addDays } from 'date-fns';
import argon2 from 'argon2';
import { Provider, Role } from '@/generated/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { LoginDto } from '@/auth/dto/login.dto';
import type { RegisterDto } from '@/auth/dto/register.dto';
import type { SwitchOrgDto } from '@/auth/dto/switch-org.dto';
import type { UpdateProfileDto } from '@/auth/dto/update-profile.dto';
import type { ChangePasswordDto } from '@/auth/dto/change-password.dto';
import { EmailTokenService } from './email-token.service';
import { MailerService } from './mailer.service';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.type';
import type { AuthResult, MemberProfile, Membership } from './auth.type';
import { uniqueOrgSlug } from './unique-org-slug';
import { REFRESH_TTL_DAYS } from './auth.constants';
import { randomToken, sha256Hex } from './tokens';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
    private readonly emailTokens: EmailTokenService,
    private readonly oauth: OAuthService,
  ) {}

  /** Self-serve signup: creates the User's own Org with them as Owner. */
  async register(dto: RegisterDto, ip: string): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(dto.password);
    const slug = await uniqueOrgSlug(this.prisma, dto.orgName);

    const { memberId, userId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: dto.name, passwordHash },
      });
      const org = await tx.org.create({
        data: { slug, name: dto.orgName },
      });
      const created = await tx.member.create({
        data: {
          orgId: org.id,
          userId: user.id,
          name: dto.name,
          role: Role.OWNER,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { lastOrgId: org.id },
      });
      return { memberId: created.id, userId: user.id };
    });

    const membership = (await this.getMembership(memberId, userId))!;
    await this.emailTokens.sendVerification(userId, email);
    return this.issueSession(membership, ip);
  }

  async login(dto: LoginDto, ip: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email not verified');
    }
    const membership = await this.resolveMembership(user.id);
    return this.issueSession(membership, ip);
  }

  /** Rotates the refresh token; a replayed pre-rotation token revokes the session. */
  async refresh(refreshToken: string, ip: string): Promise<AuthResult> {
    const hash = sha256Hex(refreshToken);
    const reused = await this.prisma.session.findFirst({
      where: { prevHashedRefresh: hash, revokedAt: null },
    });
    if (reused) {
      await this.prisma.session.update({
        where: { id: reused.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session reused');
    }

    const session = await this.prisma.session.findFirst({
      where: { hashedRefresh: hash, revokedAt: null },
    });
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid session');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) throw new UnauthorizedException('Invalid session');

    const membership = await this.resolveMembership(user.id);
    const newRefresh = randomToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        hashedRefresh: sha256Hex(newRefresh),
        prevHashedRefresh: hash,
        expiresAt: addDays(new Date(), REFRESH_TTL_DAYS),
        ip,
      },
    });
    return {
      accessToken: await this.signAccessToken(membership, session.id),
      refreshToken: newRefresh,
      profile: this.toProfile(membership),
    };
  }

  /** Revokes the session row behind a refresh token. */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { hashedRefresh: sha256Hex(refreshToken) },
      data: { revokedAt: new Date() },
    });
  }

  /** Reissues tokens for another of the user's memberships (one Org per session). */
  async switchOrg(
    dto: SwitchOrgDto,
    currentMemberId: string,
    currentRefreshToken: string,
    ip: string,
  ): Promise<AuthResult> {
    const principal = await this.prisma.member.findUnique({
      where: { id: currentMemberId },
    });
    if (!principal) throw new UnauthorizedException();
    // Bound to the presented session: a dead/absent refresh cookie cannot
    // mint a fresh session for another org.
    const session = await this.prisma.session.findFirst({
      where: { hashedRefresh: sha256Hex(currentRefreshToken), revokedAt: null },
    });
    if (!session || session.expiresAt <= new Date() || session.userId !== principal.userId) {
      throw new UnauthorizedException('Valid session required');
    }
    const membership = await this.getMembership(dto.memberId, principal.userId);
    if (!membership) throw new ForbiddenException('Not a member of this org');
    await this.logout(currentRefreshToken);
    await this.prisma.user.update({
      where: { id: principal.userId },
      data: { lastOrgId: membership.orgId },
    });
    return this.issueSession(membership, ip);
  }

  /** Issues a session for a User (OAuth flow after link-or-create). */
  async sessionForUser(userId: string, ip: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const membership = await this.resolveMembership(userId);
    return this.issueSession(membership, ip);
  }

  /** Completes an OAuth sign-in: link-or-create, personal org, session. */
  async oauthSignIn(provider: Provider, profile: OAuthProfile, ip: string): Promise<AuthResult> {
    const userId = await this.oauth.linkOrCreateUser(provider, profile);
    await this.oauth.ensureMembership(userId);
    return this.sessionForUser(userId, ip);
  }

  async me(memberId: string): Promise<MemberProfile> {
    const membership = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { org: true, team: true, user: true },
    });
    if (!membership) throw new UnauthorizedException();
    return this.toProfile(membership);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<MemberProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      include: { memberships: { include: { org: true, team: true } } },
    });
    const membership =
      (user.memberships as unknown as Membership[]).find((m) => m.orgId === user.lastOrgId) ??
      (user.memberships as unknown as Membership[])[0];
    return this.toProfile(membership);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('User not found');
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const newPasswordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  /** Picks the active membership: last used org when it is still valid, else first. */
  private async resolveMembership(userId: string): Promise<Membership> {
    const memberships = await this.prisma.member.findMany({
      where: { userId },
      include: { org: true, team: true, user: true },
    });
    if (memberships.length === 0) {
      throw new UnauthorizedException('No org membership');
    }
    const user = memberships[0].user;
    const preferred = memberships.find((m) => m.orgId === user.lastOrgId);
    return (preferred ?? memberships[0]) as unknown as Membership;
  }

  private async getMembership(memberId: string, userId: string): Promise<Membership | null> {
    return (await this.prisma.member.findFirst({
      where: { id: memberId, userId },
      include: { org: true, team: true, user: true },
    })) as unknown as Membership | null;
  }

  private async issueSession(membership: Membership, ip: string): Promise<AuthResult> {
    const refreshToken = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId: membership.user.id,
        hashedRefresh: sha256Hex(refreshToken),
        expiresAt: addDays(new Date(), REFRESH_TTL_DAYS),
        ip,
      },
    });
    return {
      accessToken: await this.signAccessToken(membership, session.id),
      refreshToken,
      profile: this.toProfile(membership),
    };
  }

  private async signAccessToken(membership: Membership, sessionId: string): Promise<string> {
    return this.jwt.signAsync({
      sub: membership.id,
      userId: membership.user.id,
      orgId: membership.orgId,
      role: membership.role,
      sessionId,
    });
  }

  private toProfile(membership: Membership): MemberProfile {
    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        emailVerified: !!membership.user.emailVerifiedAt,
      },
      member: { id: membership.id, role: membership.role },
      org: membership.org,
      team: membership.team,
    };
  }
}
