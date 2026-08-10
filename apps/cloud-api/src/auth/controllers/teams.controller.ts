import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@/generated/client';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser, Roles } from '@/auth/decorators';
import { CreateTeamDto, UpdateTeamDto, AssignTeamMemberDto } from '@/auth/dto';
import { TeamService } from '@/auth/services';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamService) {}

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedMember) {
    return this.teams.create(user.orgId, dto);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedMember) {
    return { teams: await this.teams.list(user.orgId) };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedMember,
  ) {
    return this.teams.update(user.orgId, id, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedMember) {
    await this.teams.delete(user.orgId, id);
    return { ok: true };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/members')
  async assignMember(
    @Param('id') id: string,
    @Body() dto: AssignTeamMemberDto,
    @CurrentUser() user: AuthenticatedMember,
  ) {
    return this.teams.assignMember(user.orgId, id, dto.memberId);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedMember,
  ) {
    await this.teams.removeMember(user.orgId, id, memberId);
    return { ok: true };
  }
}
