import { Body, Controller, Param, Patch } from '@nestjs/common';
import { Role } from '@/generated/client';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser, Roles } from '@/auth/decorators';
import { UpdateOrgDto } from '@/auth/dto';
import { OrgService } from '@/auth/services';

@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgService) {}

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgDto,
    @CurrentUser() _user: AuthenticatedMember,
  ) {
    return this.orgs.update(id, dto);
  }
}
