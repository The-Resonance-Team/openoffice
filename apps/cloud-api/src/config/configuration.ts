import { z } from "zod";

// Environment contract, validated once at bootstrap (ConfigModule.forRoot).
// Defaults cover local dev + unit tests; production overrides via .env.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  DATABASE_URL: z
    .string()
    .default(
      "postgresql://openoffice:openoffice@127.0.0.1:5435/openoffice_cloud"
    ),
  CORS_ORIGINS: z.string().default(""),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("15m"),
  SWAGGER_ENABLED: z.string().default("false"),
  // Email boundary (cloud ADR 0006): without SMTP_* the MailerService logs
  // instead of sending — local dev and tests never need a mail server.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Where verification/reset/invite links point (cloud-web).
  WEB_APP_URL: z.string().url().default("http://localhost:3002"),
  // OAuth providers (cloud ADR 0006): optional — strategies register only
  // when both client id and secret are present.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  // Public base URL of the API, used for OAuth callback URLs.
  PUBLIC_URL: z.string().url().default("http://localhost:3001"),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule validate fn — throws with every invalid key named. */
export function validateEnv(env: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export default function configuration() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3001),
    logLevel: process.env.LOG_LEVEL ?? "info",
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgresql://openoffice:openoffice@127.0.0.1:5435/openoffice_cloud",
    corsOrigins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    },
    webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:3002",
    publicUrl: process.env.PUBLIC_URL ?? "http://localhost:3001",
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? "false") === "true",
  };
}
