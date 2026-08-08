import { Injectable, UnauthorizedException } from "@nestjs/common";
import { addHours } from "date-fns";
import argon2 from "argon2";
import { EmailTokenType } from "@/generated/client";
import { PrismaService } from "@/prisma/prisma.service";
import { MailerService } from "./mailer.service";
import { randomToken, sha256Hex } from "./tokens";

// TTL per token purpose (cloud ADR 0006: short-lived, single-use).
const TOKEN_TTL_HOURS: Record<EmailTokenType, number> = {
  VERIFY_EMAIL: 24,
  RESET_PASSWORD: 1,
};

@Injectable()
export class EmailTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService
  ) {}

  /** Creates a token row (sha256 at rest) and returns the raw token. */
  async createToken(userId: string, type: EmailTokenType): Promise<string> {
    const raw = randomToken();
    await this.prisma.emailToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256Hex(raw),
        expiresAt: addHours(new Date(), TOKEN_TTL_HOURS[type]),
      },
    });
    return raw;
  }

  /** Consumes a verification token: single use, marks the user verified. */
  async consumeVerify(rawToken: string): Promise<void> {
    const row = await this.consume(rawToken, EmailTokenType.VERIFY_EMAIL);
    await this.prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /** Consumes a reset token and returns the owning user id. */
  async consumeReset(rawToken: string): Promise<string> {
    const row = await this.consume(rawToken, EmailTokenType.RESET_PASSWORD);
    return row.userId;
  }

  /** Verification mail for a fresh account (register, OAuth-free signup). */
  async sendVerification(userId: string, email: string): Promise<void> {
    const token = await this.createToken(userId, EmailTokenType.VERIFY_EMAIL);
    await this.mailer.send({
      to: email,
      subject: "Verify your email",
      text: `Verify your OpenOffice email:\n${this.mailer.link("/verify-email", token)}`,
    });
  }

  /**
   * Resends verification for an unverified account. Silent no-op for
   * unknown or already-verified addresses — never reveals registration.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user && !user.emailVerifiedAt) {
      await this.sendVerification(user.id, user.email);
    }
  }

  /** Reset mail for an existing account (silent for unknown addresses). */
  async sendReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return;
    const token = await this.createToken(
      user.id,
      EmailTokenType.RESET_PASSWORD
    );
    await this.mailer.send({
      to: user.email,
      subject: "Reset your password",
      text: `Reset your OpenOffice password:\n${this.mailer.link("/reset-password", token)}`,
    });
  }

  /**
   * Consumes a reset token, sets a new password and marks the email
   * verified — the reset link proves control of the mailbox.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.consumeReset(token);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(newPassword),
        emailVerifiedAt: new Date(),
      },
    });
  }

  private async consume(rawToken: string, type: EmailTokenType) {
    const row = await this.prisma.emailToken.findFirst({
      where: { tokenHash: sha256Hex(rawToken), type, usedAt: null },
    });
    if (!row || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    await this.prisma.emailToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return row;
  }
}
