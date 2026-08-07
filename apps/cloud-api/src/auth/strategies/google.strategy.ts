import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-google-oauth20";
import type { OAuthProfile } from "../services/oauth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>("google.clientId"),
      clientSecret: config.getOrThrow<string>("google.clientSecret"),
      callbackURL: `${config.getOrThrow<string>("publicUrl")}/v1/auth/login/google/callback`,
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile
  ): OAuthProfile {
    const email = profile.emails?.[0];
    return {
      providerUserId: profile.id,
      email: email?.value,
      emailVerified: email?.verified ?? false,
      name: profile.displayName,
    };
  }
}
