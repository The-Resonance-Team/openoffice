import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UserRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; name?: string; passwordHash?: string }) {
    return this.prisma.user.create({ data });
  }

  async update(
    id: string,
    data: {
      name?: string;
      passwordHash?: string;
      emailVerifiedAt?: Date;
      lastOrgId?: string;
      theme?: string;
      inviteEmail?: boolean;
      passwordChangeEmail?: boolean;
      memberJoinEmail?: boolean;
      wantsUpdates?: boolean;
      totpSecret?: string | null;
      totpEnabledAt?: Date | null;
      recoveryCodes?: string | null;
    },
  ) {
    return this.prisma.user.update({ where: { id }, data });
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
}
