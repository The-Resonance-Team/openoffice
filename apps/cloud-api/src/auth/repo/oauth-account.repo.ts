import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Provider } from '@/generated/client';

@Injectable()
export class OAuthAccountRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderAndUserId(provider: Provider, providerUserId: string) {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.oAuthAccount.findMany({ where: { userId } });
  }

  async create(data: {
    userId: string;
    provider: Provider;
    providerUserId: string;
    email?: string;
  }) {
    return this.prisma.oAuthAccount.create({ data });
  }
}
