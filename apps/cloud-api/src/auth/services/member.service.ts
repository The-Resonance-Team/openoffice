import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@/generated/client';
import { MemberRepo } from '@/auth/repo';
import type { UpdateMemberDto } from '@/auth/dto/update-member.dto';

const ROLE_RANK: Record<Role, number> = {
  [Role.OWNER]: 4,
  [Role.ADMIN]: 3,
  [Role.TEAM_LEADER]: 2,
  [Role.MEMBER]: 1,
};

@Injectable()
export class MemberService {
  constructor(private readonly members: MemberRepo) {}

  async list(orgId: string) {
    return this.members.listByOrg(orgId);
  }

  async update(orgId: string, targetMemberId: string, actorMemberId: string, dto: UpdateMemberDto) {
    const [actor, target] = await Promise.all([
      this.members.findById(actorMemberId),
      this.members.findById(targetMemberId),
    ]);
    if (!actor || !target) throw new NotFoundException('Member not found');
    if (actor.orgId !== orgId || target.orgId !== orgId)
      throw new NotFoundException('Member not found');
    if (ROLE_RANK[actor.role] < ROLE_RANK[Role.ADMIN]) {
      throw new ForbiddenException('Only Admin or Owner can change roles');
    }
    if (target.role === Role.OWNER) {
      throw new ForbiddenException('Cannot change Owner role');
    }

    return this.members.update(targetMemberId, { role: dto.role });
  }

  async remove(orgId: string, targetMemberId: string, actorMemberId: string) {
    const [actor, target] = await Promise.all([
      this.members.findById(actorMemberId),
      this.members.findById(targetMemberId),
    ]);
    if (!actor || !target) throw new NotFoundException('Member not found');
    if (actor.orgId !== orgId || target.orgId !== orgId)
      throw new NotFoundException('Member not found');
    if (ROLE_RANK[actor.role] < ROLE_RANK[Role.ADMIN]) {
      throw new ForbiddenException('Only Admin or Owner can remove members');
    }
    if (target.role === Role.OWNER) {
      throw new ForbiddenException('Cannot remove Owner');
    }

    await this.members.delete(targetMemberId);
  }
}
