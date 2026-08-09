import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@/generated/client';
import { fakeDb } from '../../../test/fake-db';
import { PrismaService } from '@/prisma/prisma.service';
import { InviteService } from './invite.service';
import { MailerService } from './mailer.service';
import type { CreateInviteDto } from '@/auth/dto/create-invite.dto';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

describe('InviteService', () => {
  let service: InviteService;
  let db: any;
  let mailer: MailerService;

  beforeEach(async () => {
    db = fakeDb();
    mailer = new MailerService(
      new ConfigService({
        resend: { from: 'no-reply@test.dev' },
        webAppUrl: 'http://localhost:3002',
      }),
    );
    service = new InviteService(db as PrismaService, mailer);
    await db.org.create({ data: { id: 'o1', slug: 'acme', name: 'Acme' } });
    await db.user.create({ data: { id: 'u-admin', email: 'admin@x.dev' } });
    await db.member.create({
      data: { orgId: 'o1', userId: 'u-admin', role: 'OWNER' },
    });
    await db.user.create({ data: { id: 'u-invitee', email: 'b@x.dev' } });
  });

  const createInvite = (dto: Partial<CreateInviteDto> = {}) =>
    service.create('o1', 'u-admin', {
      email: 'b@x.dev',
      ...dto,
    } as CreateInviteDto);

  const rawTokenOf = (send: jest.SpyInstance): string =>
    /token=([0-9a-f]+)/.exec(send.mock.calls.at(-1)[0].text)![1];

  it('stores the sha256 of the invite token with a 7-day expiry and mails the link', async () => {
    const send = jest.spyOn(mailer, 'send');
    await createInvite();
    const invites = [...db._invite.values()];
    expect(invites).toHaveLength(1);
    expect(invites[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(invites[0].role).toBe('MEMBER');
    const now = Date.now();
    expect(invites[0].expiresAt.getTime()).toBeGreaterThan(now + 6 * 86_400_000);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@x.dev' }));
    const link = send.mock.calls[0][0].text;
    expect(link).toContain('/invite?token=');
  });

  it('rejects inviting an Owner and re-inviting an existing member', async () => {
    await db.member.create({
      data: { orgId: 'o1', userId: 'u-invitee', role: 'MEMBER' },
    });
    await expect(createInvite()).rejects.toThrow(ConflictException);
    await expect(createInvite({ email: 'new@x.dev', role: Role.OWNER })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('accept creates the membership with the invited role and is single-use', async () => {
    const send = jest.spyOn(mailer, 'send');
    await createInvite();
    const token = rawTokenOf(send);
    const res = await service.accept(token, 'u-invitee');
    expect(res.orgId).toBe('o1');
    const member = await db.member.findFirst({
      where: { orgId: 'o1', userId: 'u-invitee' },
    });
    expect(member.role).toBe('MEMBER');
    await expect(service.accept(token, 'u-invitee')).rejects.toThrow(UnauthorizedException);
  });

  it('accept rejects expired invites and mismatched emails', async () => {
    const send = jest.spyOn(mailer, 'send');
    await createInvite();
    const token = rawTokenOf(send);
    const invite = await db.invite.findFirst({
      where: { tokenHash: sha256(token) },
    });
    invite.expiresAt = new Date(Date.now() - 1_000);
    await expect(service.accept(token, 'u-invitee')).rejects.toThrow(UnauthorizedException);

    await createInvite();
    const second = rawTokenOf(send);
    await db.user.create({ data: { id: 'u-other', email: 'other.dev' } });
    await expect(service.accept(second, 'u-other')).rejects.toThrow(UnauthorizedException);
  });
});
