import { Injectable, NotFoundException } from '@nestjs/common';
import { OrgRepo } from '@/auth/repo';
import type { UpdateOrgDto } from '@/auth/dto/update-org.dto';

@Injectable()
export class OrgService {
  constructor(private readonly orgs: OrgRepo) {}

  async update(orgId: string, dto: UpdateOrgDto) {
    const org = await this.orgs.findById(orgId);
    if (!org) throw new NotFoundException('Org not found');
    if (dto.name !== undefined) await this.orgs.rename(orgId, dto.name);
    if (dto.slug !== undefined) await this.orgs.changeSlug(orgId, dto.slug);
    return this.orgs.findById(orgId);
  }
}
