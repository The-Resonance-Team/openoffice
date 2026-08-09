import { Body, Controller, Post } from '@nestjs/common'
import { Role } from '@/generated/client'
import type { AuthenticatedMember } from '@/auth/strategies'
import { CurrentUser, Roles } from '@/auth/decorators'
// Regular import — see auth.controller.ts for why @Body() DTOs can't be `import type`.
import { AcceptInviteDto, CreateInviteDto } from '@/auth/dto'
import { InviteService } from '@/auth/services'

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InviteService) {}

  /** Owner/Admin only — invites carry the Analytics consent disclosure. */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateInviteDto, @CurrentUser() user: AuthenticatedMember) {
    await this.invites.create(user.orgId, user.userId, dto)
    return { ok: true }
  }

  /** Authenticated (401 → web sends the user to sign in, then retries). */
  @Post('accept')
  async accept(@Body() dto: AcceptInviteDto, @CurrentUser() user: AuthenticatedMember) {
    return this.invites.accept(dto.token, user.userId)
  }
}
