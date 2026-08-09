import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EmailTokenType } from '@/generated/client';
import { fakeDb } from '../../../test/fake-db';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailTokenService } from './email-token.service';
import { MailerService } from './mailer.service';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

const byHash = (db: any, tokenHash: string) =>
  [...db._emailToken.values()].find((r: any) => r.tokenHash === tokenHash);

describe('EmailTokenService', () => {
  let service: EmailTokenService;
  let db: any;

  beforeEach(() => {
    db = fakeDb();
    db.user.create({ data: { id: 'u1', email: 'a.dev' } });
    service = new EmailTokenService(
      db as PrismaService,
      new MailerService(
        new ConfigService({
          resend: { from: 'no-reply@test.dev' },
          webAppUrl: 'http://localhost:3002',
        }),
      ),
    );
  });

  it('stores only the sha256 of a verification token, expiring in 24h', async () => {
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    const stored = byHash(db, sha256(raw));
    expect(stored).toBeDefined();
    expect(stored.tokenHash).toBe(sha256(raw));
    expect(stored.tokenHash).not.toBe(raw);
    const now = Date.now();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(now + 23 * 3_600_000);
    expect(stored.expiresAt.getTime()).toBeLessThan(now + 25 * 3_600_000);
  });

  it('gives reset tokens a 1h expiry', async () => {
    const raw = await service.createToken('u1', EmailTokenType.RESET_PASSWORD);
    const stored = byHash(db, sha256(raw));
    const now = Date.now();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(now + 59 * 60_000);
    expect(stored.expiresAt.getTime()).toBeLessThan(now + 61 * 60_000);
  });

  it('verifies the user on consume and makes the token single-use', async () => {
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    await service.consumeVerify(raw);
    expect(db._user.get('u1').emailVerifiedAt).toBeInstanceOf(Date);
    await expect(service.consumeVerify(raw)).rejects.toThrow(/Invalid or expired token/);
  });

  it('rejects unknown and expired tokens', async () => {
    await expect(service.consumeVerify('deadbeef')).rejects.toThrow(/Invalid or expired token/);
    const raw = await service.createToken('u1', EmailTokenType.VERIFY_EMAIL);
    const stored = byHash(db, sha256(raw));
    stored.expiresAt = new Date(Date.now() - 1_000);
    await expect(service.consumeVerify(raw)).rejects.toThrow(/Invalid or expired token/);
  });

  it('consumeReset returns the userId once', async () => {
    const raw = await service.createToken('u1', EmailTokenType.RESET_PASSWORD);
    await expect(service.consumeReset(raw)).resolves.toBe('u1');
    await expect(service.consumeReset(raw)).rejects.toThrow(/Invalid or expired token/);
  });
});
