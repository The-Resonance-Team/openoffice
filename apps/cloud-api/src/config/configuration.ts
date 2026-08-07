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
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? "false") === "true",
  };
}
