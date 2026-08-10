import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ApiKeyRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  async findByKeyHash(keyHash: string) {
    return this.prisma.apiKey.findUnique({ where: { keyHash } });
  }

  async listByUserAndOrg(userId: string, orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, orgId, revokedAt: null },
    });
  }

  async create(data: {
    userId: string;
    orgId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
  }) {
    return this.prisma.apiKey.create({ data });
  }

  async update(id: string, data: { revokedAt: Date }) {
    return this.prisma.apiKey.update({ where: { id }, data });
  }
}
