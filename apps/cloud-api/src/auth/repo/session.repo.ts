import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SessionRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async findByRefreshHash(hashedRefresh: string) {
    return this.prisma.session.findFirst({ where: { hashedRefresh, revokedAt: null } });
  }

  async findActiveByUserId(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPrevRefreshHash(hashedRefresh: string) {
    return this.prisma.session.findFirst({
      where: { prevHashedRefresh: hashedRefresh, revokedAt: null },
    });
  }

  async create(data: { userId: string; hashedRefresh: string; expiresAt: Date; ip?: string }) {
    return this.prisma.session.create({ data });
  }

  async update(
    id: string,
    data: {
      hashedRefresh?: string;
      prevHashedRefresh?: string;
      expiresAt?: Date;
      revokedAt?: Date;
      ip?: string;
    },
  ) {
    return this.prisma.session.update({ where: { id }, data });
  }

  async updateManyByUserId(userId: string, data: { revokedAt: Date }) {
    return this.prisma.session.updateMany({ where: { userId }, data });
  }

  async updateManyByUserIdExceptCurrent(
    userId: string,
    currentSessionId: string,
    data: { revokedAt: Date },
  ) {
    return this.prisma.session.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data,
    });
  }

  async updateManyByRefreshHash(hashedRefresh: string, data: { revokedAt: Date }) {
    return this.prisma.session.updateMany({ where: { hashedRefresh }, data });
  }
}
