import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, VersioningType } from "@nestjs/common";
import request from "supertest";
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

  afterEach(async () => {
    await app.close();
  });
});
