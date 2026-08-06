import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, VersioningType } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import cookieParser from "cookie-parser";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors src/main.ts bootstrap
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.use(cookieParser());
    await app.init();
  });

  it("/health (GET) — public liveness, requires local Postgres (docker compose up -d postgres)", () => {
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
