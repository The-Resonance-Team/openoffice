import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@/generated/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateTeamDto } from '@/auth/dto/create-team.dto';
import type { UpdateTeamDto } from '@/auth/dto/update-team.dto';

const ROLE_RANK: Record<Role, number> = {
  [Role.OWNER]: 4,
  [Role.ADMIN]: 3,
  [Role.TEAM_LEADER]: 2,
  [Role.MEMBER]: 1,
};

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, dto: CreateTeamDto) {
    const exists = await this.prisma.team.findFirst({
      where: { orgId, name: dto.name },
    });
    if (exists) throw new ConflictException('Team name already exists');
    return this.prisma.team.create({ data: { orgId, name: dto.name } });
  }

  async list(orgId: string) {
    return this.prisma.team.findMany({
      where: { orgId },
      include: { members: true },
    });
  }

  async update(orgId: string, teamId: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, orgId } });
    if (!team) throw new NotFoundException('Team not found');
    const dup = await this.prisma.team.findFirst({
      where: { orgId, name: dto.name, id: { not: teamId } },
    });
    if (dup) throw new ConflictException('Team name already exists');
    return this.prisma.team.update({
      where: { id: teamId },
      data: { name: dto.name },
      include: { members: true },
    });
  }

  async delete(orgId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, orgId } });
    if (!team) throw new NotFoundException('Team not found');
    await this.prisma.member.updateMany({
      where: { teamId },
      data: { teamId: null },
    });
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  async assignMember(orgId: string, teamId: string, memberId: string) {
    const [team, member] = await Promise.all([
      this.prisma.team.findFirst({ where: { id: teamId, orgId } }),
      this.prisma.member.findFirst({ where: { id: memberId, orgId } }),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.member.update({
      where: { id: memberId },
      data: { teamId },
      include: { user: true, team: true },
    });
  }

  async removeMember(orgId: string, teamId: string, memberId: string) {
    const [team, member] = await Promise.all([
      this.prisma.team.findFirst({ where: { id: teamId, orgId } }),
      this.prisma.member.findFirst({ where: { id: memberId, orgId, teamId } }),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    if (!member) throw new NotFoundException('Member not in this team');
    await this.prisma.member.update({
      where: { id: memberId },
      data: { teamId: null },
    });
  }
}
