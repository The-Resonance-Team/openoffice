import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-github2";
import type { OAuthProfile } from "../services/oauth.service";

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>("github.clientId"),
      clientSecret: config.getOrThrow<string>("github.clientSecret"),
      callbackURL: `${config.getOrThrow<string>("publicUrl")}/v1/auth/login/github/callback`,
      // user:email — GitHub does not hand out emails without it; the
      // verified email is the auto-link trust anchor (ADR 0006).
      scope: ["user:email"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile
  ): OAuthProfile {
    const email = profile.emails?.[0] as
      { value: string; verified?: boolean } | undefined;
    return {
      providerUserId: profile.id,
      email: email?.value,
      emailVerified: email?.verified ?? false,
      name: profile.displayName,
    };
  }
}
