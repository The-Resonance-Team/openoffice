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
import { UserRepo, MemberRepo, OrgRepo, SessionRepo } from '@/auth/repo';
import type { LoginDto } from '@/auth/dto/login.dto';
import type { RegisterDto } from '@/auth/dto/register.dto';
import type { SwitchOrgDto } from '@/auth/dto/switch-org.dto';
import type { UpdateProfileDto } from '@/auth/dto/update-profile.dto';
import type { ChangePasswordDto } from '@/auth/dto/change-password.dto';
import type { DeleteAccountDto } from '@/auth/dto/delete-account.dto';
import { EmailTokenService } from './email-token.service';
import { MailerService } from './mailer.service';
import { OAuthService } from './oauth.service';
import type { OAuthProfile } from './oauth.type';
import type { AuthResult, MemberProfile, Membership } from './auth.type';
import { REFRESH_TTL_DAYS } from './auth.constants';
import { randomToken, sha256Hex } from './tokens';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
    private readonly emailTokens: EmailTokenService,
    private readonly oauth: OAuthService,
    private readonly users: UserRepo,
    private readonly members: MemberRepo,
    private readonly orgs: OrgRepo,
    private readonly sessions: SessionRepo,
  ) {}

  /** Self-serve signup: creates the User's own Org with them as Owner. */
  async register(dto: RegisterDto, ip: string): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(dto.password);
    const slug = await this.orgs.generateUniqueSlug(dto.orgName);

    const { memberId, userId } = await this.users.createWithOrgMembership({
      email,
      name: dto.name,
      passwordHash,
      slug,
      orgName: dto.orgName,
    });

    const membership = (await this.members.findById(memberId))!;
    await this.emailTokens.sendVerification(userId, email);
    return this.issueSession(membership, ip);
  }

  async login(dto: LoginDto, ip: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
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
    const reused = await this.sessions.findByPrevRefreshHash(hash);
    if (reused) {
      await this.sessions.revoke(reused.id);
      throw new UnauthorizedException('Session reused');
    }

    const session = await this.sessions.findByRefreshHash(hash);
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid session');
    }
    const user = await this.users.findById(session.userId);
    if (!user) throw new UnauthorizedException('Invalid session');

    const membership = await this.resolveMembership(user.id);
    const newRefresh = randomToken();
    await this.sessions.rotate(session.id, {
      hashedRefresh: sha256Hex(newRefresh),
      prevHashedRefresh: hash,
      expiresAt: addDays(new Date(), REFRESH_TTL_DAYS),
      ip,
    });
    return {
      accessToken: await this.signAccessToken(membership, session.id),
      refreshToken: newRefresh,
      profile: this.toProfile(membership),
    };
  }

  /** Revokes the session row behind a refresh token. */
  async logout(refreshToken: string): Promise<void> {
    await this.sessions.revokeByRefreshHash(sha256Hex(refreshToken));
  }

  /** Reissues tokens for another of the user's memberships (one Org per session). */
  async switchOrg(
    dto: SwitchOrgDto,
    currentMemberId: string,
    currentRefreshToken: string,
    ip: string,
  ): Promise<AuthResult> {
    const principal = await this.members.findById(currentMemberId);
    if (!principal) throw new UnauthorizedException();
    // Bound to the presented session: a dead/absent refresh cookie cannot
    // mint a fresh session for another org.
    const session = await this.sessions.findByRefreshHash(sha256Hex(currentRefreshToken));
    if (!session || session.expiresAt <= new Date() || session.userId !== principal.userId) {
      throw new UnauthorizedException('Valid session required');
    }
    const membership = await this.getMembership(dto.memberId, principal.userId);
    if (!membership) throw new ForbiddenException('Not a member of this org');
    await this.logout(currentRefreshToken);
    await this.users.setLastOrg(principal.userId, membership.orgId);
    return this.issueSession(membership, ip);
  }

  /** Issues a session for a User (OAuth flow after link-or-create). */
  async sessionForUser(userId: string, ip: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
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
    const membership = await this.members.findById(memberId);
    if (!membership) throw new UnauthorizedException();
    return this.toProfile(membership);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<MemberProfile> {
    await this.users.setName(userId, dto.name!);
    const userWithMemberships = await this.users.findWithMemberships(userId);
    if (!userWithMemberships) throw new UnauthorizedException();
    const membership =
      (userWithMemberships.memberships as unknown as Membership[]).find(
        (m) => m.orgId === userWithMemberships.lastOrgId,
      ) ?? (userWithMemberships.memberships as unknown as Membership[])[0];
    return this.toProfile(membership);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('User not found');
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const newPasswordHash = await argon2.hash(dto.newPassword);
    await this.users.setPassword(userId, newPasswordHash);
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.users.findWithMemberships(userId);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('User not found');
    }
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    // Check if user is sole owner of any org
    for (const membership of user.memberships) {
      if (membership.role === Role.OWNER) {
        const ownerCount = await this.members.countByOrgAndRole(membership.orgId, Role.OWNER);
        if (ownerCount === 1) {
          throw new ConflictException(
            `Cannot delete account: you are the sole owner of org "${membership.org.name}". Transfer ownership or delete the org first.`,
          );
        }
      }
    }

    await this.users.delete(userId);
  }

  /** Picks the active membership: last used org when it is still valid, else first. */
  private async resolveMembership(userId: string): Promise<Membership> {
    const memberships = await this.members.findByUserId(userId);
    if (memberships.length === 0) {
      throw new UnauthorizedException('No org membership');
    }
    const user = memberships[0].user;
    const preferred = memberships.find((m) => m.orgId === user.lastOrgId);
    return (preferred ?? memberships[0]) as unknown as Membership;
  }

  private async getMembership(memberId: string, userId: string): Promise<Membership | null> {
    const member = await this.members.findById(memberId);
    if (!member || member.userId !== userId) return null;
    return member as unknown as Membership;
  }

  private async issueSession(membership: Membership, ip: string): Promise<AuthResult> {
    const refreshToken = randomToken();
    const session = await this.sessions.create({
      userId: membership.user.id,
      hashedRefresh: sha256Hex(refreshToken),
      expiresAt: addDays(new Date(), REFRESH_TTL_DAYS),
      ip,
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
