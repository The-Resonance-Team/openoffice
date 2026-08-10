import { fakeDb } from '../../../test/fake-db';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgRepo } from './org.repo';

describe('OrgRepo.generateUniqueSlug', () => {
  let repo: OrgRepo;

  beforeEach(() => {
    repo = new OrgRepo(fakeDb() as PrismaService);
  });

  it('returns the slugified name when free', async () => {
    expect(await repo.generateUniqueSlug('Acme Corp')).toBe('acme-corp');
  });

  it('appends -2, -3 while taken', async () => {
    await repo.create({ slug: 'acme', name: 'Acme' });
    await repo.create({ slug: 'acme-2', name: 'Acme 2' });
    expect(await repo.generateUniqueSlug('Acme')).toBe('acme-3');
  });

  it('falls back to "org" when the name slugifies to nothing', async () => {
    expect(await repo.generateUniqueSlug('???')).toBe('org');
  });
});
