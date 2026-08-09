import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { addDays } from 'date-fns';
import { Role } from '@/generated/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateInviteDto } from '@/auth/dto/create-invite.dto';
import { MailerService } from './mailer.service';
import { randomToken, sha256Hex } from './tokens';

// Invite TTL (cloud ADR 0006: 7-day, one-time).
const INVITE_TTL_DAYS = 7;

@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  /** Invites an email into an Org (Owner/Admin only; OWNER is never invitable). */
  async create(orgId: string, invitedById: string, dto: CreateInviteDto): Promise<void> {
    const email = dto.email.toLowerCase();
    if (dto.role === Role.OWNER) {
      throw new BadRequestException('OWNER cannot be invited');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      user &&
      (await this.prisma.member.findFirst({
        where: { orgId, userId: user.id },
      }))
    ) {
      throw new ConflictException('Already a member of this org');
    }
    const raw = randomToken();
    await this.prisma.invite.create({
      data: {
        orgId,
        invitedById,
        email,
        role: dto.role ?? Role.MEMBER,
        tokenHash: sha256Hex(raw),
        expiresAt: addDays(new Date(), INVITE_TTL_DAYS),
      },
    });
    await this.mailer.send({
      to: email,
      subject: "You've been invited to an OpenOffice org",
      text:
        `Join your OpenOffice org:\n${this.mailer.link('/invite', raw)}\n\n` +
        `By joining, you agree that usage analytics of your OpenOffice daemon ` +
        `will be shared with the org that invited you (cloud/CONTEXT.md → Consent).`,
    });
  }

  /**
   * Consumes the invite: creates the membership with the invited role.
   * The accepting user's email must match the invite — it was the proof of
   * who was invited, and the invite link is the proof of email control.
   */
  async accept(token: string, userId: string): Promise<{ orgId: string; memberId: string }> {
    const invite = await this.prisma.invite.findFirst({
      where: { tokenHash: sha256Hex(token), usedAt: null },
    });
    if (!invite || invite.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired invite');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || invite.email !== user.email.toLowerCase()) {
      throw new UnauthorizedException('Invite is for a different email');
    }
    if (
      await this.prisma.member.findFirst({
        where: { orgId: invite.orgId, userId },
      })
    ) {
      throw new ConflictException('Already a member of this org');
    }
    const member = await this.prisma.member.create({
      data: { orgId: invite.orgId, userId, role: invite.role },
    });
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    return { orgId: invite.orgId, memberId: member.id };
  }
}
