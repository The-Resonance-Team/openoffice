import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TeamRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      include: { members: true },
    });
  }

  async findByOrgAndName(orgId: string, name: string) {
    return this.prisma.team.findFirst({ where: { orgId, name } });
  }

  async listByOrg(orgId: string) {
    return this.prisma.team.findMany({
      where: { orgId },
      include: { members: true },
    });
  }

  async create(data: { orgId: string; name: string }) {
    return this.prisma.team.create({ data });
  }

  async rename(id: string, name: string) {
    return this.prisma.team.update({
      where: { id },
      data: { name },
      include: { members: true },
    });
  }

  async delete(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }
}
