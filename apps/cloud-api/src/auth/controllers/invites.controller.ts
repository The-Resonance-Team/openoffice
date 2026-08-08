import { Body, Controller, Post } from "@nestjs/common";
import { Role } from "@/generated/client";
import type { AuthenticatedMember } from "@/auth/strategies";
import { CurrentUser } from "@/auth/decorators";
import { Roles } from "@/auth/decorators";
import type { AcceptInviteDto } from "@/auth/dto";
import type { CreateInviteDto } from "@/auth/dto";
import { InviteService } from "@/auth/services";

@Controller("invites")
export class InvitesController {
  constructor(private readonly invites: InviteService) {}

  /** Owner/Admin only — invites carry the Analytics consent disclosure. */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: AuthenticatedMember
  ) {
    await this.invites.create(user.orgId, user.userId, dto);
    return { ok: true };
  }

  /** Authenticated (401 → web sends the user to sign in, then retries). */
  @Post("accept")
  async accept(
    @Body() dto: AcceptInviteDto,
    @CurrentUser() user: AuthenticatedMember
  ) {
    return this.invites.accept(dto.token, user.userId);
  }
}
