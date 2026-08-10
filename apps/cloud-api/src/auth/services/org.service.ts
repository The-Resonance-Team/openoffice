import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { UpdateOrgDto } from '@/auth/dto/update-org.dto';

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  async update(orgId: string, dto: UpdateOrgDto) {
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');
    return this.prisma.org.update({
      where: { id: orgId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
      },
    });
  }
}
