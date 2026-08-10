import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Role } from '@/generated/client';

@Injectable()
export class MemberRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.member.findUnique({
      where: { id },
      include: { user: true, org: true, team: true },
    });
  }

  async findByOrgAndUser(orgId: string, userId: string) {
    return this.prisma.member.findFirst({
      where: { orgId, userId },
      include: { user: true, org: true, team: true },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.member.findMany({
      where: { userId },
      include: { org: true, team: true, user: true },
    });
  }

  async listByOrg(orgId: string) {
    return this.prisma.member.findMany({
      where: { orgId },
      include: { user: true, team: true },
    });
  }

  async create(data: {
    orgId: string;
    userId: string;
    role?: Role;
    name?: string;
    teamId?: string;
  }) {
    return this.prisma.member.create({ data });
  }

  async changeRole(id: string, role: Role) {
    return this.prisma.member.update({
      where: { id },
      data: { role },
      include: { user: true, team: true },
    });
  }

  async assignTeam(id: string, teamId: string) {
    return this.prisma.member.update({
      where: { id },
      data: { teamId },
      include: { user: true, team: true },
    });
  }

  async clearTeam(id: string) {
    return this.prisma.member.update({
      where: { id },
      data: { teamId: null },
      include: { user: true, team: true },
    });
  }

  async delete(id: string) {
    return this.prisma.member.delete({ where: { id } });
  }

  async countByOrgAndRole(orgId: string, role: Role) {
    return this.prisma.member.count({ where: { orgId, role } });
  }

  async clearTeamForAll(teamId: string) {
    return this.prisma.member.updateMany({ where: { teamId }, data: { teamId: null } });
  }
}
