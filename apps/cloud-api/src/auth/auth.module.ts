import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import {
  ApiKeysController,
  AuthController,
  InvitesController,
} from "./controllers";
import {
  ApiKeyService,
  AuthService,
  EmailTokenService,
  InviteService,
  MailerService,
  OAuthService,
} from "./services";
import {
  ApiKeyStrategy,
  GithubStrategy,
  GoogleStrategy,
  JwtStrategy,
} from "./strategies";

// OAuth strategies register only when their provider credentials exist —
// local dev without GOOGLE_*/GITHUB_* envs stays bootable (password auth).
function oauthStrategies() {
  const strategies = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    strategies.push(GoogleStrategy);
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    strategies.push(GithubStrategy);
  }
  return strategies;
}

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("jwt.secret"),
        // zod-validated string; cast at the config trust boundary
        signOptions: {
          expiresIn: config.get<string>(
            "jwt.expiresIn"
          ) as JwtSignOptions["expiresIn"],
        },
      }),
    }),
  ],
  controllers: [AuthController, ApiKeysController, InvitesController],
  providers: [
    AuthService,
    ApiKeyService,
    EmailTokenService,
    InviteService,
    MailerService,
    OAuthService,
    JwtStrategy,
    ApiKeyStrategy,
    ...oauthStrategies(),
  ],
  exports: [JwtModule, AuthService, ApiKeyService, OAuthService, InviteService],
})
export class AuthModule {}
