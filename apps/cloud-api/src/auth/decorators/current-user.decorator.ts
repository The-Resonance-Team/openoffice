import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedMember } from '@/auth/strategies'

/** The authenticated principal (JWT or API key) attached by the global guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedMember =>
    ctx.switchToHttp().getRequest().user,
)
