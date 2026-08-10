import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Role } from '@/generated/client';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser, Roles } from '@/auth/decorators';
// Regular import — see auth.controller.ts for why @Body() DTOs can't be `import type`.
import { AcceptInviteDto, CreateInviteDto } from '@/auth/dto';
import { InviteService } from '@/auth/services';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InviteService) {}

  /** Owner/Admin only — invites carry the Analytics consent disclosure. */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateInviteDto, @CurrentUser() user: AuthenticatedMember) {
    await this.invites.create(user.orgId, user.userId, dto);
    return { ok: true };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get()
  async list(@CurrentUser() user: AuthenticatedMember) {
    const invites = await this.invites.list(user.orgId);
    return { invites };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedMember) {
    await this.invites.cancel(user.orgId, id);
    return { ok: true };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/resend')
  async resend(@Param('id') id: string, @CurrentUser() user: AuthenticatedMember) {
    await this.invites.resend(user.orgId, id);
    return { ok: true };
  }

  /** Authenticated (401 → web sends the user to sign in, then retries). */
  @Post('accept')
  async accept(@Body() dto: AcceptInviteDto, @CurrentUser() user: AuthenticatedMember) {
    return this.invites.accept(dto.token, user.userId);
  }
}
