import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "@/auth/decorators";

/**
 * Global guard (APP_GUARD): every route requires a JWT (web session) or a
 * Daemon API Key (x-api-key header, daemon/CLI) unless @Public().
 */
@Injectable()
export class ApiKeyOrJwtGuard extends AuthGuard(["jwt", "api-key"]) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
