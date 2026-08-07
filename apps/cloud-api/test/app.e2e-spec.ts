import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, VersioningType } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import cookieParser from "cookie-parser";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { PrismaService } from "./../src/prisma/prisma.service";

// CI has no Postgres, so the health DB ping is served by a stub that always
// reports the database up. Real DB reachability stays a local-compose
// concern (`docker compose up -d postgres`).
// The stub mimics a SQL Prisma client: terminus pings via `$runCommandRaw`
// (Mongo path) and falls back to `$queryRawUnsafe('SELECT 1')` when the
// client reports it is not a Mongo provider.
const prismaStub = {
  $runCommandRaw: jest
    .fn()
    .mockRejectedValue(new Error("Use the mongodb provider")),
  $queryRawUnsafe: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
  $disconnect: jest.fn().mockResolvedValue(undefined),
} as unknown as PrismaService;

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirrors src/main.ts bootstrap
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.use(cookieParser());
    await app.init();
  });

  it("/health (GET) — public liveness (DB ping stubbed — no local Postgres needed)", () => {
    return request(app.getHttpServer())
      .get("/v1/health")
      .expect(200)
      .expect((res) => {
        expect((res.body as { status: string }).status).toBe("ok");
      });
  });

  it("everything else (GET /v1) requires a JWT", () => {
    return request(app.getHttpServer()).get("/v1").expect(401);
  });

  it("GET /v1 accepts a JWT from the `token` cookie", async () => {
    const token = app.get(JwtService).sign({
      sub: "member-1",
      orgId: "org-1",
      role: "ADMIN",
    });
    return request(app.getHttpServer())
      .get("/v1")
      .set("Cookie", `token=${token}`)
      .expect(200);
  });

  it("GET /v1 accepts a JWT from the Authorization header", async () => {
    const token = app.get(JwtService).sign({
      sub: "member-1",
      orgId: "org-1",
      role: "ADMIN",
    });
    return request(app.getHttpServer())
      .get("/v1")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
