import { createHash, randomBytes } from "node:crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, VersioningType } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import cookieParser from "cookie-parser";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { EmailTokenType } from "./../src/generated/client";
import { EmailTokenService } from "./../src/auth/services/email-token.service";
import { PrismaService } from "./../src/prisma/prisma.service";

// Requires the local dev database: `docker compose up -d postgres` (root
// docker-compose.yml, port 5435) — the standing Postgres-always-Docker rule.
// One shared verified user covers most flows, keeping register/login calls
// under the per-route throttler limits (5 and 10 per minute).

const sha256 = (s: string): string =>
  createHash("sha256").update(s).digest("hex");
const seq = Date.now().toString(36);
const email = (n: string) => `${n}-${seq}@e2e.dev`;
const password = "password123";

describe("Cloud API (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sharedCookies: string[];
  let sharedProfile: any;
  let dupCookies: string[] = [];
  const cookiesOf = (res: any): string[] =>
    res.headers["set-cookie"] as string[];

  async function register(n: string, orgName = "E2E Org") {
    const res: any = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: email(n), password, name: n, orgName })
      .expect(201);
    return cookiesOf(res);
  }

  async function meOf(cookies: string[]): Promise<any> {
    const res: any = await request(app.getHttpServer())
      .get("/v1/auth/me")
      .set("Cookie", cookies)
      .expect(200);
    return res.body.profile;
  }

  async function verifyAndLogin(n: string) {
    const cookies = await register(n);
    const userId = (await meOf(cookies)).user.id;
    const token = await app
      .get(EmailTokenService)
      .createToken(userId, EmailTokenType.VERIFY_EMAIL);
    await request(app.getHttpServer())
      .post("/v1/auth/verify-email")
      .send({ token })
      .expect(201);
    const res: any = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: email(n), password })
      .expect(201);
    return cookiesOf(res);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors src/main.ts bootstrap
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    // shared verified user, registered and unlocked before the tests
    sharedCookies = await register("shared");
    sharedProfile = await meOf(sharedCookies);
    const sharedId = sharedProfile.user.id;
    const token = await app
      .get(EmailTokenService)
      .createToken(sharedId, EmailTokenType.VERIFY_EMAIL);
    await request(app.getHttpServer())
      .post("/v1/auth/verify-email")
      .send({ token })
      .expect(201);
    const res: any = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: email("shared"), password })
      .expect(201);
    sharedCookies = cookiesOf(res);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${seq}@e2e.dev` } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /v1/health is public; other routes require a JWT or API key", async () => {
    const health: any = await request(app.getHttpServer())
      .get("/v1/health")
      .expect(200);
    expect(health.body.status).toBe("ok");
    await request(app.getHttpServer()).get("/v1").expect(401);
  });

  it("register creates a personal org with an OWNER member and session cookies", async () => {
    expect(sharedProfile.org.name).toBe("E2E Org");
    expect(sharedProfile.member.role).toBe("OWNER");
    expect(sharedProfile.user.email).toBe(email("shared"));
    expect(sharedProfile.user.emailVerified).toBe(false);
  });

  it("register rejects duplicate emails", async () => {
    await register("dup");
    await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: email("dup"), password, name: "dup", orgName: "X" })
      .expect(409);
  });

  it("login blocks unverified accounts until verify-email is consumed", async () => {
    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: email("dup"), password })
      .expect(401);

    const dup = await prisma.user.findUnique({
      where: { email: email("dup") },
    });
    const token = await app
      .get(EmailTokenService)
      .createToken(dup!.id, EmailTokenType.VERIFY_EMAIL);
    await request(app.getHttpServer())
      .post("/v1/auth/verify-email")
      .send({ token })
      .expect(201);
    const res: any = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: email("dup"), password })
      .expect(201);
    const me: any = await request(app.getHttpServer())
      .get("/v1/auth/me")
      .set("Cookie", cookiesOf(res))
      .expect(200);
    expect(me.body.profile.user.emailVerified).toBe(true);
    dupCookies = cookiesOf(res);
  });

  it("refresh rotates the refresh token; the old one dies", async () => {
    const oldRefresh = sharedCookies.find((c) => c.startsWith("refresh="))!;

    const res: any = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Cookie", sharedCookies)
      .expect(201);
    const newRefresh = cookiesOf(res).find((c) => c.startsWith("refresh="))!;
    expect(newRefresh).not.toBe(oldRefresh);

    await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .set("Cookie", oldRefresh)
      .expect(401);
    sharedCookies = cookiesOf(res);
  });

  it("Daemon API keys: create once, list, authenticate via x-api-key, revoke", async () => {
    const created: any = await request(app.getHttpServer())
      .post("/v1/api-keys")
      .set("Cookie", sharedCookies)
      .send({ name: "ci machine" })
      .expect(201);
    const rawKey = created.body.key as string;
    expect(rawKey).toMatch(/^oo_live_/);

    const listed: any = await request(app.getHttpServer())
      .get("/v1/api-keys")
      .set("Cookie", sharedCookies)
      .expect(200);
    expect(listed.body.keys).toHaveLength(1);

    const viaKey: any = await request(app.getHttpServer())
      .get("/v1/auth/me")
      .set("x-api-key", rawKey)
      .expect(200);
    expect(viaKey.body.profile.user.email).toBe(email("shared"));

    await request(app.getHttpServer())
      .delete(`/v1/api-keys/${listed.body.keys[0].id}`)
      .set("Cookie", sharedCookies)
      .expect(200);
    await request(app.getHttpServer())
      .get("/v1/auth/me")
      .set("x-api-key", rawKey)
      .expect(401);
  });

  it("invite flow: Owner invites, the invitee accepts and gains the role", async () => {
    const inviteeEmail = email("dup");
    await request(app.getHttpServer())
      .post("/v1/invites")
      .set("Cookie", sharedCookies)
      .send({ email: inviteeEmail, role: "ADMIN" })
      .expect(201);

    const invite = await prisma.invite.findFirst({
      where: { email: inviteeEmail, usedAt: null },
    });
    expect(invite).not.toBeNull();

    // The raw token lives only in the emailed link; simulate the mailer by
    // writing the hash of a token we hold into the invite row.
    const raw = randomBytes(32).toString("hex");
    await prisma.invite.update({
      where: { id: invite!.id },
      data: { tokenHash: sha256(raw) },
    });

    await request(app.getHttpServer())
      .post("/v1/invites/accept")
      .set("Cookie", dupCookies)
      .send({ token: raw })
      .expect(201);

    const invitee = await prisma.user.findUnique({
      where: { email: inviteeEmail },
      include: { memberships: true },
    });
    expect(invitee!.memberships).toHaveLength(2); // personal org + invited org
    const inOrg = invitee!.memberships.find((m) => m.orgId === invite!.orgId);
    expect(inOrg?.role).toBe("ADMIN");
  });

  it("reset-password flow sets a new password via a minted token", async () => {
    const profile = await meOf(sharedCookies);
    const token = await app
      .get(EmailTokenService)
      .createToken(profile.user.id, EmailTokenType.RESET_PASSWORD);

    await request(app.getHttpServer())
      .post("/v1/auth/reset-password")
      .send({ token, password: "newpassword123" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: email("shared"), password: "newpassword123" })
      .expect(201);
  });

  it("GET /v1 accepts a JWT from the `token` cookie", async () => {
    const token = app.get(JwtService).sign({
      sub: "member-e2e",
      userId: "user-e2e",
      orgId: "org-e2e",
      role: "ADMIN",
    });
    await request(app.getHttpServer())
      .get("/v1")
      .set("Cookie", `token=${token}`)
      .expect(200);
  });
});
