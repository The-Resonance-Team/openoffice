import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '@/generated/client'
import { ROLES_KEY } from '@/auth/decorators'

// Role hierarchy (cloud ADR 0001): higher roles pass any lower-role gate.
const ROLE_WEIGHT: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  TEAM_LEADER: 2,
  MEMBER: 1,
}

/**
 * Enforces @Roles(...) from the principal's role. Team-scoped permissions
 * (TEAM_LEADER sees only their Team) are enforced in services, not here.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const user = context.switchToHttp().getRequest().user
    const minWeight = Math.min(...required.map((r) => ROLE_WEIGHT[r]))
    if (!user || ROLE_WEIGHT[user.role as Role] < minWeight) {
      throw new ForbiddenException('Insufficient role')
    }
    return true
  }
}
