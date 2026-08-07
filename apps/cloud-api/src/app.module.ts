import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ApiKeyOrJwtGuard } from "./auth/guards/api-key-or-jwt.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import configuration, { validateEnv } from "./config/configuration";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    // Foundation first (reference: BenhVienPhuThoProMax/apps/api):
    // config, logger, prisma, throttle, health.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("logLevel"),
          ...(config.get<string>("nodeEnv") !== "production"
            ? {
                transport: {
                  target: "pino-pretty",
                  options: { singleLine: true },
                },
              }
            : {}),
        },
      }),
    }),
    // 30 req/min globally across the service (reference default).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    TerminusModule,
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Throttle before auth so flood attempts never reach JWT/passport work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global guard: all routes require a JWT or Daemon API Key unless @Public().
    { provide: APP_GUARD, useClass: ApiKeyOrJwtGuard },
    // @Roles() enforcement, after the principal is attached above.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
