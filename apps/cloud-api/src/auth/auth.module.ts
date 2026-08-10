import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  ApiKeysController,
  AuthController,
  InvitesController,
  MembersController,
  OrgsController,
  SessionsController,
  TeamsController,
} from './controllers';
import {
  ApiKeyService,
  AuthService,
  EmailTokenService,
  InviteService,
  MailerService,
  MemberService,
  OAuthService,
  OrgService,
  SessionService,
  TeamService,
} from './services';
import { ApiKeyStrategy, GithubStrategy, GoogleStrategy, JwtStrategy } from './strategies';

/**
 * Registers an OAuth strategy only when the provider's credentials are
 * configured (local dev without the Google/GitHub env pairs stays bootable
 * on password auth). The presence check reads the validated config; the
 * strategy constructor then getOrThrows the client id/secret before they
 * ever reach passport — undefined secrets fail loudly at boot, not inside
 * the OAuth2 handshake.
 */
function oauthStrategyProvider(
  Strategy: typeof GoogleStrategy,
  provider: 'google' | 'github',
): Provider {
  return {
    provide: Strategy,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const clientId = config.get<string>(`${provider}.clientId`);
      const clientSecret = config.get<string>(`${provider}.clientSecret`);
      if (!clientId || !clientSecret) return null;
      return new Strategy(config);
    },
  };
}

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        // zod-validated string; cast at the config trust boundary
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    ApiKeysController,
    InvitesController,
    MembersController,
    OrgsController,
    SessionsController,
    TeamsController,
  ],
  providers: [
    AuthService,
    ApiKeyService,
    EmailTokenService,
    InviteService,
    MailerService,
    MemberService,
    OAuthService,
    OrgService,
    SessionService,
    TeamService,
    JwtStrategy,
    ApiKeyStrategy,
    oauthStrategyProvider(GoogleStrategy, 'google'),
    oauthStrategyProvider(GithubStrategy, 'github'),
  ],
  exports: [
    JwtModule,
    AuthService,
    ApiKeyService,
    OAuthService,
    InviteService,
    MemberService,
    OrgService,
    SessionService,
    TeamService,
  ],
})
export class AuthModule {}
