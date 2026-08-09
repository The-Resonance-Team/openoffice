import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Provider } from '@/generated/client';
import { Cookies, CurrentUser, Public } from '@/auth/decorators';
import type { AuthenticatedMember } from '@/auth/strategies';
import {
  ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TTL_DAYS,
  AuthService,
  EmailTokenService,
  type OAuthProfile,
  type AuthResult,
} from '@/auth/services';

// Regular (not `import type`) — Nest's ValidationPipe needs the real class
// reference at runtime to reflect @Body() param metadata; a type-only import
// erases it, degrading whitelist/forbidNonWhitelisted validation.
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SwitchOrgDto,
  VerifyEmailDto,
} from '@/auth/dto';

const ACCESS_COOKIE_MAX_AGE = ACCESS_TOKEN_TTL_MINUTES * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = REFRESH_TTL_DAYS * 24 * 3600 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailTokens: EmailTokenService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res() res: Response) {
    const result = await this.auth.register(dto, ipOf(req));
    this.setAuthCookies(res, result);
    res.json({ profile: result.profile });
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const result = await this.auth.login(dto, ipOf(req));
    this.setAuthCookies(res, result);
    res.json({ profile: result.profile });
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Cookies('refresh') refresh: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.auth.refresh(refresh ?? '', ipOf(req));
    this.setAuthCookies(res, result);
    res.json({ profile: result.profile });
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Cookies('refresh') refresh: string | undefined, @Res() res: Response) {
    await this.auth.logout(refresh ?? '');
    this.clearAuthCookies(res);
    res.end();
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedMember) {
    return { profile: await this.auth.me(user.memberId) };
  }

  @Post('switch-org')
  async switchOrg(
    @Body() dto: SwitchOrgDto,
    @CurrentUser() user: AuthenticatedMember,
    @Cookies('refresh') refresh: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.auth.switchOrg(dto, user.memberId, refresh ?? '', ipOf(req));
    this.setAuthCookies(res, result);
    res.json({ profile: result.profile });
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.emailTokens.consumeVerify(dto.token);
    return { ok: true };
  }

  @Public()
  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.emailTokens.resendVerification(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.emailTokens.sendReset(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.emailTokens.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Public()
  @Get('login/google')
  @UseGuards(AuthGuard('google'))
  googleRedirect() {
    // passport handles the redirect to Google's consent screen
  }

  @Public()
  @Get('login/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this.oauthCallback(Provider.GOOGLE, req.user as OAuthProfile, req, res);
  }

  @Public()
  @Get('login/github')
  @UseGuards(AuthGuard('github'))
  githubRedirect() {
    // passport handles the redirect to GitHub's consent screen
  }

  @Public()
  @Get('login/github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    await this.oauthCallback(Provider.GITHUB, req.user as OAuthProfile, req, res);
  }

  private async oauthCallback(
    provider: Provider,
    profile: OAuthProfile | undefined,
    req: Request,
    res: Response,
  ) {
    if (!profile) return res.redirect(this.webAppUrl());
    const result = await this.auth.oauthSignIn(provider, profile, ipOf(req));
    this.setAuthCookies(res, result);
    res.redirect(this.webAppUrl());
  }

  private setAuthCookies(res: Response, result: AuthResult): void {
    const secure = this.config.get<string>('nodeEnv') === 'production';
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });
    res.cookie('refresh', result.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie('token');
    res.clearCookie('refresh');
  }

  private webAppUrl(): string {
    return this.config.getOrThrow<string>('webAppUrl');
  }
}

function ipOf(req: Request): string {
  return (req.ip ?? 'unknown').slice(0, 45);
}
