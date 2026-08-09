import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport';
import type { Request } from 'express';
import { ApiKeyService } from '@/auth/services/api-key.service';

/**
 * Authenticates a Daemon API Key presented as `x-api-key: oo_live_...`.
 * The principal carries the same shape as the JWT user, plus key/user ids.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly apiKeys: ApiKeyService) {
    super();
  }

  authenticate(req: Request): void {
    const key = (req.headers['x-api-key'] as string | undefined) ?? '';
    this.apiKeys
      .authenticate(key)
      .then((principal) => this.success(principal))
      .catch(() => this.fail(401));
  }

  // passport's base Strategy drives `authenticate`; this satisfies the
  // @nestjs/passport mixin type and is never invoked.
  validate(): never {
    throw new Error('not used');
  }
}
