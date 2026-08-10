import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { Role } from '@/generated/client';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser, Roles } from '@/auth/decorators';
import { UpdateMemberDto } from '@/auth/dto';
import { MemberService } from '@/auth/services';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MemberService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedMember) {
    const members = await this.members.list(user.orgId);
    return { members };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedMember,
  ) {
    return this.members.update(user.orgId, id, user.memberId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedMember) {
    await this.members.remove(user.orgId, id, user.memberId);
    return { ok: true };
  }
}
