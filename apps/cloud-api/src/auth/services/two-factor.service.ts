import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { UserRepo } from '@/auth/repo';

@Injectable()
export class TwoFactorService {
  constructor(private readonly users: UserRepo) {}

  async setup(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.totpEnabledAt) {
      throw new BadRequestException('2FA already enabled');
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'OpenOffice Cloud',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    await this.users.setTotpSecret(userId, secret.base32);

    return { otpauthUrl, qrCode };
  }

  async verify(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user?.totpSecret) {
      throw new BadRequestException('2FA not set up');
    }
    if (user.totpEnabledAt) {
      throw new BadRequestException('2FA already enabled');
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'OpenOffice Cloud',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.totpSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      throw new UnauthorizedException('Invalid code');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.users.enableTotp(userId, {
      enabledAt: new Date(),
      recoveryCodes: JSON.stringify(recoveryCodes),
    });

    return { recoveryCodes };
  }

  async disable(userId: string, password: string) {
    const user = await this.users.findById(userId);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.totpEnabledAt) {
      throw new BadRequestException('2FA not enabled');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.users.clearTotp(userId);
  }

  async regenerateRecoveryCodes(userId: string) {
    const user = await this.users.findById(userId);
    if (!user?.totpEnabledAt) {
      throw new BadRequestException('2FA not enabled');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.users.setRecoveryCodes(userId, JSON.stringify(recoveryCodes));

    return { recoveryCodes };
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () => randomBytes(5).toString('hex').toUpperCase());
  }
}
