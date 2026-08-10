import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { EmailTokenType } from '@/generated/client';

@Injectable()
export class EmailTokenRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string) {
    return this.prisma.emailToken.findFirst({
      where: { tokenHash, usedAt: null },
    });
  }

  async findValidToken(userId: string, type: EmailTokenType) {
    return this.prisma.emailToken.findFirst({
      where: { userId, type, usedAt: null },
    });
  }

  async create(data: { userId: string; type: EmailTokenType; tokenHash: string; expiresAt: Date }) {
    return this.prisma.emailToken.create({ data });
  }

  async update(id: string, data: { usedAt: Date }) {
    return this.prisma.emailToken.update({ where: { id }, data });
  }

  async markUsedMany(userId: string, type: EmailTokenType) {
    return this.prisma.emailToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
