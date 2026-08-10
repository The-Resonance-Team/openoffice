import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepo } from '@/auth/repo';
import type { UpdatePreferencesDto } from '@/auth/dto/update-preferences.dto';
import type { UpdateNotificationsDto } from '@/auth/dto/update-notifications.dto';
import type { UpdateUpdatesDto } from '@/auth/dto/update-updates.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly users: UserRepo) {}

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.users.setTheme(userId, dto.theme);
  }

  async updateNotifications(userId: string, dto: UpdateNotificationsDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.users.setNotificationPrefs(userId, {
      inviteEmail: dto.inviteEmail,
      passwordChangeEmail: dto.passwordChangeEmail,
      memberJoinEmail: dto.memberJoinEmail,
    });
  }

  async updateUpdates(userId: string, dto: UpdateUpdatesDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.users.setWantsUpdates(userId, dto.wantsUpdates);
  }
}
