import type { PrismaService } from '../src/prisma/prisma.service';

let seq = 0;
const nid = (p: string): string => `${p}${++seq}`;
const eq = (where: Record<string, unknown> | undefined, row: any): boolean =>
  Object.entries(where ?? {}).every(([k, v]) => {
    // compound unique keys arrive as `{ provider_providerUserId: {...} }`
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      // Handle "not" operator: { id: { not: "xxx" } }
      if ('not' in v) {
        return row[k] !== v.not;
      }
      return Object.entries(v).every(([ck, cv]) => row[ck] === cv);
    }
    return row[k] === v;
  });

/**
 * In-memory fake of the Prisma boundary with real equality semantics for the
 * scalar queries the services issue (reuse/expiry/role behavior is real).
 * Access the raw stores via the `_<model>` maps when a test needs to seed or
 * mutate state directly.
 */
export function fakeDb(): PrismaService {
  const maps: Record<string, Map<string, any>> = {
    user: new Map<string, any>(),
    org: new Map<string, any>(),
    team: new Map<string, any>(),
    member: new Map<string, any>(),
    session: new Map<string, any>(),
    apiKey: new Map<string, any>(),
    emailToken: new Map<string, any>(),
    invite: new Map<string, any>(),
    oAuthAccount: new Map<string, any>(),
  };

  // relation name -> [store map name, foreign-key column]
  const RELATIONS: Record<string, [string, string]> = {
    org: ['org', 'orgId'],
    user: ['user', 'userId'],
    team: ['team', 'teamId'],
  };

  // reverse relations: parent model -> [child map name, foreign-key column]
  const REVERSE_RELATIONS: Record<string, [string, string]> = {
    team: ['member', 'teamId'],
  };

  const store = (map: Map<string, any>, modelName: string) => {
    const withIncludes = (row: any, include?: Record<string, boolean>): any => {
      if (!include) return row;
      const out = { ...row };
      for (const [rel, [mapName, fk]] of Object.entries(RELATIONS)) {
        if (include[rel]) {
          out[rel] = row[fk] ? (maps[mapName].get(row[fk]) ?? null) : null;
        }
      }
      // Handle reverse relations (e.g., team.members) - only for the parent model
      if (REVERSE_RELATIONS[modelName]) {
        const [childMapName, fk] = REVERSE_RELATIONS[modelName];
        for (const rel of Object.keys(include)) {
          if (rel === Object.keys(REVERSE_RELATIONS)[0]) {
            out[rel] = [...maps[childMapName].values()].filter((child) => child[fk] === row.id);
          }
        }
      }
      return out;
    };
    return {
      create: async ({ data }: any) => {
        const row = {
          id: nid('r'),
          createdAt: new Date(),
          usedAt: null,
          revokedAt: null,
          emailVerifiedAt: null,
          lastOrgId: null,
          teamId: null,
          prevHashedRefresh: null,
          name: null,
          passwordHash: null,
          ...data,
        };
        map.set(row.id, row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = [...map.values()].find((r) => eq(where, r));
        return row ? withIncludes(row, include) : null;
      },
      findFirst: async ({ where, include }: any) => {
        const row = [...map.values()].find((r) => eq(where, r));
        return row ? withIncludes(row, include) : null;
      },
      findMany: async ({ where, include }: any = {}) =>
        [...map.values()].filter((r) => eq(where, r)).map((r) => withIncludes(r, include)),
      count: async ({ where }: any = {}) => [...map.values()].filter((r) => eq(where, r)).length,
      update: async ({ where, data }: any) => {
        const row = [...map.values()].find((r) => eq(where, r));
        if (!row) throw new Error('fake: update target not found');
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const targets = [...map.values()].filter((r) => eq(where, r));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
      delete: async ({ where }: any) => {
        const row = [...map.values()].find((r) => eq(where, r));
        if (!row) throw new Error('fake: delete target not found');
        map.delete(row.id);
        return row;
      },
    };
  };

  const models = Object.fromEntries(
    Object.entries(maps).map(([name, map]) => [name, store(map, name)]),
  );

  const self: any = {
    ...models,
    $transaction: (arg: any) => (typeof arg === 'function' ? arg(self) : Promise.all(arg)),
    ...Object.fromEntries(Object.entries(maps).map(([name, map]) => [`_${name}`, map])),
  };
  return self as PrismaService;
}
