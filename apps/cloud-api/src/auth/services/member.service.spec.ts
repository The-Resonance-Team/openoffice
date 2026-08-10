import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@/generated/client';
import { makeFakeRepos } from '../../../test/fake-repos';
import { MemberService } from './member.service';
import type { UpdateMemberDto } from '@/auth/dto/update-member.dto';

describe('MemberService', () => {
  let service: MemberService;
  let maps: ReturnType<typeof makeFakeRepos>['maps'];

  beforeEach(() => {
    const repos = makeFakeRepos();
    maps = repos.maps;
    service = new MemberService(repos.members);
    maps.org.set('o1', { id: 'o1', slug: 'acme', name: 'Acme' });
    maps.user.set('u-owner', { id: 'u-owner', email: 'owner@x.dev' });
    maps.user.set('u-admin', { id: 'u-admin', email: 'admin@x.dev' });
    maps.user.set('u-member', { id: 'u-member', email: 'member@x.dev' });
    maps.member.set('m-owner', {
      id: 'm-owner',
      orgId: 'o1',
      userId: 'u-owner',
      role: Role.OWNER,
      teamId: null,
    });
    maps.member.set('m-admin', {
      id: 'm-admin',
      orgId: 'o1',
      userId: 'u-admin',
      role: Role.ADMIN,
      teamId: null,
    });
    maps.member.set('m-member', {
      id: 'm-member',
      orgId: 'o1',
      userId: 'u-member',
      role: Role.MEMBER,
      teamId: null,
    });
  });

  describe('list', () => {
    it('returns all members in the org with user data', async () => {
      const members = await service.list('o1');
      expect(members).toHaveLength(3);
      expect(members[0].user.email).toBeDefined();
    });
  });

  describe('update', () => {
    it('allows OWNER to change a member role', async () => {
      const dto: UpdateMemberDto = { role: Role.TEAM_LEADER };
      const updated = await service.update('o1', 'm-member', 'm-owner', dto);
      expect(updated.role).toBe(Role.TEAM_LEADER);
    });

    it('allows ADMIN to change a member role', async () => {
      const dto: UpdateMemberDto = { role: Role.TEAM_LEADER };
      const updated = await service.update('o1', 'm-member', 'm-admin', dto);
      expect(updated.role).toBe(Role.TEAM_LEADER);
    });

    it('rejects MEMBER from changing roles', async () => {
      const dto: UpdateMemberDto = { role: Role.ADMIN };
      await expect(service.update('o1', 'm-admin', 'm-member', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('prevents changing the OWNER role to another member', async () => {
      const dto: UpdateMemberDto = { role: Role.ADMIN };
      await expect(service.update('o1', 'm-owner', 'm-admin', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws if member not found', async () => {
      const dto: UpdateMemberDto = { role: Role.ADMIN };
      await expect(service.update('o1', 'm-missing', 'm-owner', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('allows OWNER to remove a member', async () => {
      await service.remove('o1', 'm-member', 'm-owner');
      const members = await service.list('o1');
      expect(members).toHaveLength(2);
    });

    it('allows ADMIN to remove a member', async () => {
      await service.remove('o1', 'm-member', 'm-admin');
      const members = await service.list('o1');
      expect(members).toHaveLength(2);
    });

    it('rejects MEMBER from removing others', async () => {
      await expect(service.remove('o1', 'm-admin', 'm-member')).rejects.toThrow(ForbiddenException);
    });

    it('prevents removing the OWNER', async () => {
      await expect(service.remove('o1', 'm-owner', 'm-admin')).rejects.toThrow(ForbiddenException);
    });

    it('throws if member not found', async () => {
      await expect(service.remove('o1', 'm-missing', 'm-owner')).rejects.toThrow(NotFoundException);
    });
  });
});
