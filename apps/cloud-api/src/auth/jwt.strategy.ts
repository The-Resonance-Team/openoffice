import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "../generated/client";

export interface JwtPayload {
  sub: string; // memberId
  orgId: string;
  role: Role;
}

export interface AuthenticatedMember {
  memberId: string;
  orgId: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("jwt.secret"),
    });
  }

  validate(payload: JwtPayload): AuthenticatedMember {
    return {
      memberId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
    };
  }
}
