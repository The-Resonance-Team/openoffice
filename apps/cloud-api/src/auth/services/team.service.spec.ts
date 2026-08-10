import { ConflictException, NotFoundException } from '@nestjs/common';
import { makeFakeRepos } from '../../../test/fake-repos';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let maps: ReturnType<typeof makeFakeRepos>['maps'];

  beforeEach(() => {
    const repos = makeFakeRepos();
    maps = repos.maps;
    service = new TeamService(repos.teams, repos.members);
    maps.org.set('o1', { id: 'o1', slug: 'acme', name: 'Acme' });
    maps.user.set('u1', { id: 'u1', email: 'a@x.dev' });
    maps.user.set('u2', { id: 'u2', email: 'b@x.dev' });
    maps.member.set('m1', { id: 'm1', orgId: 'o1', userId: 'u1', role: 'OWNER', teamId: null });
    maps.member.set('m2', { id: 'm2', orgId: 'o1', userId: 'u2', role: 'MEMBER', teamId: null });
  });

  describe('create', () => {
    it('creates a team', async () => {
      const team = await service.create('o1', { name: 'Engineering' });
      expect(team.name).toBe('Engineering');
      expect(team.orgId).toBe('o1');
    });

    it('rejects duplicate team names', async () => {
      await service.create('o1', { name: 'Engineering' });
      await expect(service.create('o1', { name: 'Engineering' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('list', () => {
    it('returns all teams in the org', async () => {
      await service.create('o1', { name: 'Engineering' });
      await service.create('o1', { name: 'Design' });
      const teams = await service.list('o1');
      expect(teams).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('renames a team', async () => {
      const team = await service.create('o1', { name: 'Eng' });
      const updated = await service.update('o1', team.id, { name: 'Engineering' });
      expect(updated.name).toBe('Engineering');
    });

    it('throws if team not found', async () => {
      await expect(service.update('o1', 'missing', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes a team and unassigns members', async () => {
      const team = await service.create('o1', { name: 'Eng' });
      await service.assignMember('o1', team.id, 'm1');
      await service.delete('o1', team.id);
      const teams = await service.list('o1');
      expect(teams).toHaveLength(0);
      expect(maps.member.get('m1').teamId).toBeNull();
    });
  });

  describe('assignMember', () => {
    it('assigns a member to a team', async () => {
      const team = await service.create('o1', { name: 'Eng' });
      const member = await service.assignMember('o1', team.id, 'm1');
      expect(member.teamId).toBe(team.id);
    });

    it('throws if member not found', async () => {
      const team = await service.create('o1', { name: 'Eng' });
      await expect(service.assignMember('o1', team.id, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeMember', () => {
    it('removes a member from a team', async () => {
      const team = await service.create('o1', { name: 'Eng' });
      await service.assignMember('o1', team.id, 'm1');
      await service.removeMember('o1', team.id, 'm1');
      expect(maps.member.get('m1').teamId).toBeNull();
    });

    it('throws if member not in team', async () => {
      const team = await service.create('o1', { name: 'Eng' });
      await expect(service.removeMember('o1', team.id, 'm1')).rejects.toThrow(NotFoundException);
    });
  });
});
