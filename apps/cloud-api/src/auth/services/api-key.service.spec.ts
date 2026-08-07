import { createHash } from "node:crypto";
import { fakeDb } from "../../../test/fake-db";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateApiKeyDto } from "../dto";
import { ApiKeyService } from "./api-key.service";

const sha256 = (s: string): string =>
  createHash("sha256").update(s).digest("hex");

const dto = (name: string) => ({ name }) as CreateApiKeyDto;

describe("ApiKeyService", () => {
  let service: ApiKeyService;
  let db: any;

  beforeEach(async () => {
    db = fakeDb();
    service = new ApiKeyService(db as PrismaService);
    await db.user.create({ data: { id: "u1", email: "a@x.dev" } });
    await db.org.create({ data: { id: "o1", slug: "acme", name: "Acme" } });
    await db.org.create({ data: { id: "o2", slug: "second", name: "Second" } });
    await db.member.create({
      data: { id: "m1", orgId: "o1", userId: "u1", role: "MEMBER" },
    });
    await db.member.create({
      data: { id: "m2", orgId: "o2", userId: "u1", role: "MEMBER" },
    });
  });

  it("returns the raw key once and stores only its sha256 with a display prefix", async () => {
    const raw = await service.create(dto("work mac"), "u1", "o1");
    expect(raw).toMatch(/^oo_live_[0-9a-f]{64}$/);
    const rows = [...db._apiKey.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(sha256(raw));
    expect(rows[0].keyHash).not.toBe(raw);
    expect(rows[0].keyPrefix).toBe(raw.slice(0, 14));
    expect(rows[0].name).toBe("work mac");
  });

  it("lists active keys without the hash, scoped to the session org", async () => {
    await service.create(dto("a"), "u1", "o1");
    await service.create(dto("b"), "u1", "o1");
    await service.create(dto("other org"), "u1", "o2");
    const list = await service.list("u1", "o1");
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: "a", keyPrefix: expect.any(String) });
    expect(JSON.stringify(list)).not.toContain("keyHash");
  });

  it("revokes a key by id: gone from the list, verify fails", async () => {
    await service.create(dto("a"), "u1", "o1");
    const [key] = await service.list("u1", "o1");
    await service.revoke("u1", "o1", key.id);
    expect(await service.list("u1", "o1")).toHaveLength(0);
  });

  it("revoking someone else's key or another org's key is a no-op", async () => {
    await service.create(dto("a"), "u1", "o1");
    const [key] = await service.list("u1", "o1");
    await service.revoke("u-other", "o1", key.id);
    await service.revoke("u1", "o2", key.id);
    expect(await service.list("u1", "o1")).toHaveLength(1);
  });

  it("verify resolves the member's org and role; misses without membership", async () => {
    const raw = await service.create(dto("a"), "u1", "o1");
    const principal = await service.verify(raw);
    expect(principal).toMatchObject({
      memberId: "m1",
      orgId: "o1",
      role: "MEMBER",
      userId: "u1",
    });

    for (const [k] of db._member) db._member.delete(k);
    expect(await service.verify(raw)).toBeNull();
  });
});
