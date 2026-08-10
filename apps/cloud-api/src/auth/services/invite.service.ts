import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { addDays } from 'date-fns';
import { Role } from '@/generated/client';
import { InviteRepo, UserRepo, MemberRepo } from '@/auth/repo';
import type { CreateInviteDto } from '@/auth/dto/create-invite.dto';
import { MailerService } from './mailer.service';
import { randomToken, sha256Hex } from './tokens';

// Invite TTL (cloud ADR 0006: 7-day, one-time).
const INVITE_TTL_DAYS = 7;

@Injectable()
export class InviteService {
  constructor(
    private readonly invites: InviteRepo,
    private readonly users: UserRepo,
    private readonly members: MemberRepo,
    private readonly mailer: MailerService,
  ) {}

  /** Invites an email into an Org (Owner/Admin only; OWNER is never invitable). */
  async create(orgId: string, invitedById: string, dto: CreateInviteDto): Promise<void> {
    const email = dto.email.toLowerCase();
    if (dto.role === Role.OWNER) {
      throw new BadRequestException('OWNER cannot be invited');
    }
    const user = await this.users.findByEmail(email);
    if (user) {
      const existingMember = await this.members.findByOrgAndUser(orgId, user.id);
      if (existingMember) {
        throw new ConflictException('Already a member of this org');
      }
    }
    const raw = randomToken();
    await this.invites.create({
      orgId,
      invitedById,
      email,
      role: dto.role ?? Role.MEMBER,
      tokenHash: sha256Hex(raw),
      expiresAt: addDays(new Date(), INVITE_TTL_DAYS),
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
    const invite = await this.invites.findByTokenHash(sha256Hex(token));
    if (!invite || invite.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired invite');
    }
    const user = await this.users.findById(userId);
    if (!user || invite.email !== user.email.toLowerCase()) {
      throw new UnauthorizedException('Invite is for a different email');
    }
    const existingMember = await this.members.findByOrgAndUser(invite.orgId, userId);
    if (existingMember) {
      throw new ConflictException('Already a member of this org');
    }
    const member = await this.members.create({ orgId: invite.orgId, userId, role: invite.role });
    await this.invites.update(invite.id, { usedAt: new Date() });
    return { orgId: invite.orgId, memberId: member.id };
  }

  async list(orgId: string) {
    return this.invites.listByOrg(orgId);
  }

  async cancel(orgId: string, inviteId: string) {
    const invite = await this.invites.findById(inviteId);
    if (!invite || invite.orgId !== orgId || invite.usedAt) {
      throw new UnauthorizedException('Invite not found');
    }
    await this.invites.update(inviteId, { usedAt: new Date() });
  }

  async resend(orgId: string, inviteId: string) {
    const invite = await this.invites.findById(inviteId);
    if (!invite || invite.orgId !== orgId || invite.usedAt) {
      throw new UnauthorizedException('Invite not found');
    }
    const raw = randomToken();
    await this.invites.update(inviteId, {
      tokenHash: sha256Hex(raw),
      expiresAt: addDays(new Date(), INVITE_TTL_DAYS),
    });
    await this.mailer.send({
      to: invite.email,
      subject: "You've been invited to an OpenOffice org",
      text:
        `Join your OpenOffice org:\n${this.mailer.link('/invite', raw)}\n\n` +
        `By joining, you agree that usage analytics of your OpenOffice daemon ` +
        `will be shared with the org that invited you (cloud/CONTEXT.md → Consent).`,
    });
  }
}
