import { Controller, Delete, Get, Param } from '@nestjs/common';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser } from '@/auth/decorators';
import { SessionService } from '@/auth/services';

@Controller('me/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedMember) {
    return { sessions: await this.sessions.list(user.userId, user.sessionId) };
  }

  @Delete(':id')
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedMember) {
    await this.sessions.revoke(user.userId, id);
    return { ok: true };
  }

  @Delete()
  async revokeAllOthers(@CurrentUser() user: AuthenticatedMember) {
    await this.sessions.revokeAllOthers(user.userId, user.sessionId);
    return { ok: true };
  }
}
