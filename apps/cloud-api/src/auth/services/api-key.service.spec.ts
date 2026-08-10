import { createHash } from 'node:crypto';
import { makeFakeRepos } from '../../../test/fake-repos';
import type { CreateApiKeyDto } from '@/auth/dto';
import { ApiKeyService } from './api-key.service';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

const dto = (name: string) => ({ name }) as CreateApiKeyDto;

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let maps: ReturnType<typeof makeFakeRepos>['maps'];

  beforeEach(() => {
    const repos = makeFakeRepos();
    maps = repos.maps;
    service = new ApiKeyService(repos.apiKeys, repos.members);
    maps.user.set('u1', { id: 'u1', email: 'a@x.dev' });
    maps.org.set('o1', { id: 'o1', slug: 'acme', name: 'Acme' });
    maps.org.set('o2', { id: 'o2', slug: 'second', name: 'Second' });
    maps.member.set('m1', { id: 'm1', orgId: 'o1', userId: 'u1', role: 'MEMBER', teamId: null });
    maps.member.set('m2', { id: 'm2', orgId: 'o2', userId: 'u1', role: 'MEMBER', teamId: null });
  });

  it('returns the raw key once and stores only its sha256 with a display prefix', async () => {
    const raw = await service.create(dto('work mac'), 'u1', 'o1');
    expect(raw).toMatch(/^oo_live_[0-9a-f]{64}$/);
    const rows = [...maps.apiKey.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(sha256(raw));
    expect(rows[0].keyHash).not.toBe(raw);
    expect(rows[0].keyPrefix).toBe(raw.slice(0, 14));
    expect(rows[0].name).toBe('work mac');
  });

  it('lists active keys without the hash, scoped to the session org', async () => {
    await service.create(dto('a'), 'u1', 'o1');
    await service.create(dto('b'), 'u1', 'o1');
    await service.create(dto('other org'), 'u1', 'o2');
    const list = await service.list('u1', 'o1');
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: 'a', keyPrefix: expect.any(String) });
    expect(JSON.stringify(list)).not.toContain('keyHash');
  });

  it('revokes a key by id: gone from the list, verify fails', async () => {
    const raw = await service.create(dto('revoke me'), 'u1', 'o1');
    const list = await service.list('u1', 'o1');
    await service.revoke('u1', 'o1', list[0].id);
    const after = await service.list('u1', 'o1');
    expect(after).toHaveLength(0);
    const principal = await service.verify(raw);
    expect(principal).toBeNull();
  });

  it('verify resolves the principal (key + membership) for a valid raw key', async () => {
    const raw = await service.create(dto('verify me'), 'u1', 'o1');
    const principal = await service.verify(raw);
    expect(principal).toMatchObject({
      userId: 'u1',
      memberId: 'm1',
      orgId: 'o1',
      role: 'MEMBER',
    });
    expect(principal?.keyId).toBe(maps.apiKey.values().next().value.id);
  });

  it('verify returns null for an unknown or revoked key', async () => {
    expect(await service.verify('oo_live_deadbeef')).toBeNull();
    const raw = await service.create(dto('revoke'), 'u1', 'o1');
    const list = await service.list('u1', 'o1');
    await service.revoke('u1', 'o1', list[0].id);
    expect(await service.verify(raw)).toBeNull();
  });

  it('authenticate throws for an invalid key', async () => {
    await expect(service.authenticate('oo_live_deadbeef')).rejects.toThrow(/Invalid API key/);
  });
});
