import { Injectable, NotFoundException } from '@nestjs/common';
import { OrgRepo } from '@/auth/repo';
import type { UpdateOrgDto } from '@/auth/dto/update-org.dto';

@Injectable()
export class OrgService {
  constructor(private readonly orgs: OrgRepo) {}

  async update(orgId: string, dto: UpdateOrgDto) {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Org not found');
    return this.orgs.update(orgId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
    });
  }
}
