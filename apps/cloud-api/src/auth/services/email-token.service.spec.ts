import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { addHours, addMinutes, subMilliseconds } from 'date-fns';
import { EmailTokenType } from '@/generated/client';
import { makeFakeRepos } from '../../../test/fake-repos';
import { EmailTokenService } from './email-token.service';
import { MailerService } from './mailer.service';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

const byHash = (maps: ReturnType<typeof makeFakeRepos>['maps'], tokenHash: string) =>
  [...maps.emailToken.values()].find((r) => r.tokenHash === tokenHash);

describe('EmailTokenService', () => {
  let service: EmailTokenService;
  let maps: ReturnType<typeof makeFakeRepos>['maps'];

  beforeEach(() => {
    const repos = makeFakeRepos();
    maps = repos.maps;
    maps.user.set('u1', { id: 'u1', email: 'a.dev' });
    service = new EmailTokenService(
      repos.emailTokens,
      repos.users,
      new MailerService(
        new ConfigService({
          resend: { from: 'no-reply@test.dev' },
          webAppUrl: 'http://localhost:5202',
        }),
      ),
    );
  });

  it('stores only the sha256 of a verification token, expiring in 24h', async () => {
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    const stored = byHash(maps, sha256(raw));
    expect(stored).toBeDefined();
    expect(stored.tokenHash).toBe(sha256(raw));
    expect(stored.tokenHash).not.toBe(raw);
    const now = Date.now();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(addHours(now, 23).getTime());
    expect(stored.expiresAt.getTime()).toBeLessThan(addHours(now, 25).getTime());
  });

  it('gives reset tokens a 1h expiry', async () => {
    const raw = await service.createToken('u1', EmailTokenType.RESET_PASSWORD);
    const stored = byHash(maps, sha256(raw));
    const now = Date.now();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(addMinutes(now, 59).getTime());
    expect(stored.expiresAt.getTime()).toBeLessThan(addMinutes(now, 61).getTime());
  });

  it('consumeVerify marks the token used and the user verified', async () => {
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    await service.consumeVerify(raw);
    const stored = byHash(maps, sha256(raw));
    expect(stored.usedAt).toBeDefined();
    expect(maps.user.get('u1').emailVerifiedAt).toBeDefined();
  });

  it('consumeVerify rejects a reused token', async () => {
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    await service.consumeVerify(raw);
    await expect(service.consumeVerify(raw)).rejects.toThrow(/Invalid or expired token/);
  });

  it('consumeVerify rejects an expired token', async () => {
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    const stored = byHash(maps, sha256(raw));
    stored.expiresAt = subMilliseconds(new Date(), 1);
    await expect(service.consumeVerify(raw)).rejects.toThrow(/Invalid or expired token/);
  });

  it('sendReset is a silent no-op for an unknown email', async () => {
    const send = jest.spyOn((service as any).mailer, 'send');
    await service.sendReset('unknown@x.dev');
    expect(send).not.toHaveBeenCalled();
  });
});
