import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Role } from '@/generated/client';

@Injectable()
export class InviteRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.invite.findUnique({ where: { id } });
  }

  async findByTokenHash(tokenHash: string) {
    return this.prisma.invite.findFirst({
      where: { tokenHash, usedAt: null },
    });
  }

  async listByOrg(orgId: string) {
    return this.prisma.invite.findMany({
      where: { orgId, usedAt: null },
    });
  }

  async findByOrgAndEmail(orgId: string, email: string) {
    return this.prisma.invite.findFirst({
      where: { orgId, email, usedAt: null },
    });
  }

  async create(data: {
    orgId: string;
    invitedById: string;
    email: string;
    role: Role;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.invite.create({ data });
  }

  async update(id: string, data: { usedAt?: Date; tokenHash?: string; expiresAt?: Date }) {
    return this.prisma.invite.update({ where: { id }, data });
  }
}
