import { NotFoundException } from '@nestjs/common';
import { makeFakeRepos } from '../../../test/fake-repos';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;
  let maps: ReturnType<typeof makeFakeRepos>['maps'];

  beforeEach(() => {
    const repos = makeFakeRepos();
    maps = repos.maps;
    service = new SessionService(repos.sessions);
    maps.user.set('u1', { id: 'u1', email: 'a@x.dev' });
    maps.session.set('s1', {
      id: 's1',
      userId: 'u1',
      ip: '1.1.1.1',
      revokedAt: null,
      createdAt: new Date(Date.now() - 2000),
      expiresAt: new Date(Date.now() + 86400000),
    });
    maps.session.set('s2', {
      id: 's2',
      userId: 'u1',
      ip: '2.2.2.2',
      revokedAt: null,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 86400000),
    });
  });

  describe('list', () => {
    it('returns all active sessions for the user', async () => {
      const sessions = await service.list('u1', 's1');
      expect(sessions).toHaveLength(2);
      expect(sessions.find((s) => s.id === 's1')?.isCurrent).toBe(true);
      expect(sessions.find((s) => s.id === 's2')?.isCurrent).toBe(false);
    });
  });

  describe('revoke', () => {
    it('revokes a specific session', async () => {
      await service.revoke('u1', 's2');
      const sessions = await service.list('u1', 's1');
      expect(sessions).toHaveLength(1);
    });

    it('throws if session not found', async () => {
      await expect(service.revoke('u1', 's-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeAllOthers', () => {
    it('revokes all sessions except the current one', async () => {
      await service.revokeAllOthers('u1', 's1');
      const sessions = await service.list('u1', 's1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('s1');
    });
  });
});
