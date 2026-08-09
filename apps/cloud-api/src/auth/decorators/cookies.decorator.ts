import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Reads one cookie from the request (NestJS docs pattern). */
export const Cookies = createParamDecorator(
  (name: string, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest().cookies?.[name],
);
