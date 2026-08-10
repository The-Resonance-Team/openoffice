import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { UpdatePreferencesDto } from '@/auth/dto/update-preferences.dto';
import type { UpdateNotificationsDto } from '@/auth/dto/update-notifications.dto';
import type { UpdateUpdatesDto } from '@/auth/dto/update-updates.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { theme: dto.theme },
    });
  }

  async updateNotifications(userId: string, dto: UpdateNotificationsDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        inviteEmail: dto.inviteEmail,
        passwordChangeEmail: dto.passwordChangeEmail,
        memberJoinEmail: dto.memberJoinEmail,
      },
    });
  }

  async updateUpdates(userId: string, dto: UpdateUpdatesDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { wantsUpdates: dto.wantsUpdates },
    });
  }
}
