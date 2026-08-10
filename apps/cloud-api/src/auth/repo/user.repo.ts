import { Injectable } from '@nestjs/common';
import { Role } from '@/generated/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface CreateWithOrgMembershipData {
  email: string;
  name?: string;
  passwordHash?: string;
  slug: string;
  orgName: string;
}

@Injectable()
export class UserRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: {
    email: string;
    name?: string;
    passwordHash?: string;
    emailVerifiedAt?: Date;
  }) {
    return this.prisma.user.create({ data });
  }

  async setName(id: string, name: string) {
    return this.prisma.user.update({ where: { id }, data: { name } });
  }

  async setPassword(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async setLastOrg(id: string, orgId: string) {
    return this.prisma.user.update({ where: { id }, data: { lastOrgId: orgId } });
  }

  async markVerified(id: string) {
    return this.prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  }

  async setPasswordAndVerified(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, emailVerifiedAt: new Date() },
    });
  }

  async setTheme(id: string, theme: string) {
    return this.prisma.user.update({ where: { id }, data: { theme } });
  }

  async setNotificationPrefs(
    id: string,
    data: { inviteEmail: boolean; passwordChangeEmail: boolean; memberJoinEmail: boolean },
  ) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async setWantsUpdates(id: string, wantsUpdates: boolean) {
    return this.prisma.user.update({ where: { id }, data: { wantsUpdates } });
  }

  async setTotpSecret(id: string, secret: string) {
    return this.prisma.user.update({ where: { id }, data: { totpSecret: secret } });
  }

  async enableTotp(id: string, data: { enabledAt: Date; recoveryCodes: string }) {
    return this.prisma.user.update({
      where: { id },
      data: { totpEnabledAt: data.enabledAt, recoveryCodes: data.recoveryCodes },
    });
  }

  async clearTotp(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { totpSecret: null, totpEnabledAt: null, recoveryCodes: null },
    });
  }

  async setRecoveryCodes(id: string, recoveryCodes: string) {
    return this.prisma.user.update({ where: { id }, data: { recoveryCodes } });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async findWithMemberships(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { memberships: { include: { org: true, team: true } } },
    });
  }

  /**
   * Self-serve signup in one transaction: User + their own Org + OWNER
   * membership, then the Org becomes the User's last-used Org. The repo
   * owns the transaction — the service never touches a raw tx handle.
   */
  async createWithOrgMembership(data: CreateWithOrgMembershipData) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash: data.passwordHash },
      });
      const org = await tx.org.create({
        data: { slug: data.slug, name: data.orgName },
      });
      const member = await tx.member.create({
        data: { orgId: org.id, userId: user.id, name: data.name, role: Role.OWNER },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { lastOrgId: org.id },
      });
      return { memberId: member.id, userId: user.id };
    });
  }
}
