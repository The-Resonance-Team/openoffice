import { Body, Controller, Post } from '@nestjs/common';
import type { AuthenticatedMember } from '@/auth/strategies';
import { CurrentUser } from '@/auth/decorators';
import { VerifyTotpDto, DisableTotpDto } from '@/auth/dto';
import { TwoFactorService } from '@/auth/services';

@Controller('me/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Post('setup')
  async setup(@CurrentUser() user: AuthenticatedMember) {
    return this.twoFactor.setup(user.userId);
  }

  @Post('verify')
  async verify(@Body() dto: VerifyTotpDto, @CurrentUser() user: AuthenticatedMember) {
    return this.twoFactor.verify(user.userId, dto.code);
  }

  @Post('disable')
  async disable(@Body() dto: DisableTotpDto, @CurrentUser() user: AuthenticatedMember) {
    await this.twoFactor.disable(user.userId, dto.password);
    return { ok: true };
  }

  @Post('recovery-codes')
  async regenerateRecoveryCodes(@CurrentUser() user: AuthenticatedMember) {
    return this.twoFactor.regenerateRecoveryCodes(user.userId);
  }
}
