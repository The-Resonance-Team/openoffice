import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Provider, Role } from '@/generated/client';
import { PrismaService } from '@/prisma/prisma.service';
import { OAuthAccountRepo, UserRepo, MemberRepo, OrgRepo } from '@/auth/repo';
import type { OAuthProfile } from './oauth.type';

/** Normalized provider profile (strategies map passport profiles to this). */
@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthAccounts: OAuthAccountRepo,
    private readonly users: UserRepo,
    private readonly members: MemberRepo,
    private readonly orgs: OrgRepo,
  ) {}

  /**
   * Finds or creates the User behind a provider identity (cloud ADR 0006):
   * same provider account → same User; else auto-link to the User with the
   * same email when the provider verified it; else create a fresh User.
   * Requires a provider-verified email — no synthetic addresses.
   */
  async linkOrCreateUser(provider: Provider, profile: OAuthProfile): Promise<string> {
    const existing = await this.oauthAccounts.findByProviderAndUserId(
      provider,
      profile.providerUserId,
    );
    if (existing) return existing.userId;

    const email = profile.email?.toLowerCase();
    if (!email || !profile.emailVerified) {
      throw new UnauthorizedException('Provider did not return a verified email');
    }

    let user = await this.users.findByEmail(email);
    if (!user) {
      user = await this.users.create({
        email,
        name: profile.name,
      });
      await this.users.update(user.id, { emailVerifiedAt: new Date() });
    }
    await this.oauthAccounts.create({
      provider,
      providerUserId: profile.providerUserId,
      email,
      userId: user.id,
    });
    // The provider already verified the email — the linked password account
    // inherits that verification (ADR 0006: provider-verified = verified).
    if (!user.emailVerifiedAt) {
      await this.users.update(user.id, { emailVerifiedAt: new Date() });
    }
    return user.id;
  }

  /**
   * Gives a memberless User their own personal Org with them as OWNER —
   * the OAuth counterpart of self-serve signup (ADR 0006, Q7).
   */
  async ensureMembership(userId: string): Promise<void> {
    const memberships = await this.members.findByUserId(userId);
    if (memberships.length > 0) return;
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const slug = await this.orgs.generateUniqueSlug(user.name ?? user.email.split('@')[0] ?? 'org');
    await this.prisma.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: { slug, name: user.name ?? user.email },
      });
      await tx.member.create({
        data: { orgId: org.id, userId, role: Role.OWNER },
      });
      await tx.user.update({
        where: { id: userId },
        data: { lastOrgId: org.id },
      });
    });
  }
}
