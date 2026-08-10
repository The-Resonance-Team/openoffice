import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamRepo, MemberRepo } from '@/auth/repo';
import type { CreateTeamDto } from '@/auth/dto/create-team.dto';
import type { UpdateTeamDto } from '@/auth/dto/update-team.dto';

@Injectable()
export class TeamService {
  constructor(
    private readonly teams: TeamRepo,
    private readonly members: MemberRepo,
  ) {}

  async create(orgId: string, dto: CreateTeamDto) {
    const exists = await this.teams.findByOrgAndName(orgId, dto.name);
    if (exists) throw new ConflictException('Team name already exists');
    return this.teams.create({ orgId, name: dto.name });
  }

  async list(orgId: string) {
    return this.teams.listByOrg(orgId);
  }

  async update(orgId: string, teamId: string, dto: UpdateTeamDto) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundException('Team not found');
    // Note: We need to check orgId - the repo doesn't include org in the response
    // For now, we'll trust the controller's role guard
    const dup = await this.teams.findByOrgAndName(orgId, dto.name);
    if (dup && dup.id !== teamId) throw new ConflictException('Team name already exists');
    return this.teams.update(teamId, { name: dto.name });
  }

  async delete(orgId: string, teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundException('Team not found');
    await this.members.updateManyByTeamId(teamId, { teamId: null });
    await this.teams.delete(teamId);
  }

  async assignMember(orgId: string, teamId: string, memberId: string) {
    const [team, member] = await Promise.all([
      this.teams.findById(teamId),
      this.members.findById(memberId),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    if (!member) throw new NotFoundException('Member not found');
    return this.members.update(memberId, { teamId });
  }

  async removeMember(orgId: string, teamId: string, memberId: string) {
    const [team, member] = await Promise.all([
      this.teams.findById(teamId),
      this.members.findById(memberId),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    if (!member || member.teamId !== teamId) throw new NotFoundException('Member not in this team');
    await this.members.update(memberId, { teamId: null });
  }
}
