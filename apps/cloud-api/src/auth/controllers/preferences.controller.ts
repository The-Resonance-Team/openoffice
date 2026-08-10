import { Body, Controller, Patch } from '@nestjs/common';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser } from '@/auth/decorators';
import { UpdatePreferencesDto, UpdateNotificationsDto, UpdateUpdatesDto } from '@/auth/dto';
import { PreferencesService } from '@/auth/services';

@Controller('me')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Patch('preferences')
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: AuthenticatedMember,
  ) {
    await this.preferences.updatePreferences(user.userId, dto);
    return { ok: true };
  }

  @Patch('notifications')
  async updateNotifications(
    @Body() dto: UpdateNotificationsDto,
    @CurrentUser() user: AuthenticatedMember,
  ) {
    await this.preferences.updateNotifications(user.userId, dto);
    return { ok: true };
  }

  @Patch('updates')
  async updateUpdates(@Body() dto: UpdateUpdatesDto, @CurrentUser() user: AuthenticatedMember) {
    await this.preferences.updateUpdates(user.userId, dto);
    return { ok: true };
  }
}
