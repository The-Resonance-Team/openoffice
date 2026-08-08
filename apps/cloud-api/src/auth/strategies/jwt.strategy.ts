import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { Role } from "@/generated/client";
import type { AuthenticatedMember, JwtPayload } from "./jwt.type";

// JWT from the Authorization: Bearer header OR the `token` httpOnly cookie
// (cookieParser is registered in main.ts). Header wins if both are present.
const TOKEN_COOKIE = "token";

function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.[TOKEN_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("jwt.secret"),
    });
  }

  validate(payload: JwtPayload): AuthenticatedMember {
    return {
      memberId: payload.sub,
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role,
    };
  }
}
