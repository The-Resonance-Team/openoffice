import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Provider, Role } from "@/generated/client";
import { PrismaService } from "@/prisma/prisma.service";
import { uniqueOrgSlug } from "./unique-org-slug";
import type { OAuthProfile } from "./oauth.type";

/** Normalized provider profile (strategies map passport profiles to this). */
@Injectable()
export class OAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds or creates the User behind a provider identity (cloud ADR 0006):
   * same provider account → same User; else auto-link to the User with the
   * same email when the provider verified it; else create a fresh User.
   * Requires a provider-verified email — no synthetic addresses.
   */
  async linkOrCreateUser(
    provider: Provider,
    profile: OAuthProfile
  ): Promise<string> {
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
    });
    if (existing) return existing.userId;

    const email = profile.email?.toLowerCase();
    if (!email || !profile.emailVerified) {
      throw new UnauthorizedException(
        "Provider did not return a verified email"
      );
    }

    const user =
      (await this.prisma.user.findUnique({ where: { email } })) ??
      (await this.prisma.user.create({
        data: {
          email,
          name: profile.name,
          emailVerifiedAt: new Date(),
        },
      }));
    await this.prisma.oAuthAccount.create({
      data: {
        provider,
        providerUserId: profile.providerUserId,
        email,
        userId: user.id,
      },
    });
    // The provider already verified the email — the linked password account
    // inherits that verification (ADR 0006: provider-verified = verified).
    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return user.id;
  }

  /**
   * Gives a memberless User their own personal Org with them as OWNER —
   * the OAuth counterpart of self-serve signup (ADR 0006, Q7).
   */
  async ensureMembership(userId: string): Promise<void> {
    const count = await this.prisma.member.count({
      where: { userId },
    });
    if (count > 0) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const slug = await uniqueOrgSlug(
      this.prisma,
      user.name ?? user.email.split("@")[0] ?? "org"
    );
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
