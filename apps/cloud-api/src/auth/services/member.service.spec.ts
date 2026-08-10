import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@/generated/client';
import { fakeDb } from '../../../test/fake-db';
import { PrismaService } from '@/prisma/prisma.service';
import { MemberRepo } from '@/auth/repo';
import { MemberService } from './member.service';
import type { UpdateMemberDto } from '@/auth/dto/update-member.dto';

describe('MemberService', () => {
  let service: MemberService;
  let db: any;

  beforeEach(async () => {
    db = fakeDb();
    const members = new MemberRepo(db as PrismaService);
    service = new MemberService(members);
    await db.org.create({ data: { id: 'o1', slug: 'acme', name: 'Acme' } });
    await db.user.create({ data: { id: 'u-owner', email: 'owner@x.dev' } });
    await db.user.create({ data: { id: 'u-admin', email: 'admin@x.dev' } });
    await db.user.create({ data: { id: 'u-member', email: 'member@x.dev' } });
    await db.member.create({
      data: { id: 'm-owner', orgId: 'o1', userId: 'u-owner', role: Role.OWNER },
    });
    await db.member.create({
      data: { id: 'm-admin', orgId: 'o1', userId: 'u-admin', role: Role.ADMIN },
    });
    await db.member.create({
      data: { id: 'm-member', orgId: 'o1', userId: 'u-member', role: Role.MEMBER },
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
