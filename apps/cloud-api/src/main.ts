// NestJS bootstrap — foundation per the reference stack
// (BenhVienPhuThoProMax/apps/api):
//   - bufferLogs + nestjs-pino (early logs route through Pino)
//   - helmet, compression, cookie-parser
//   - global ValidationPipe (whitelist + forbidNonWhitelisted + transform)
//   - URI versioning, CORS from config, graceful shutdown hooks
//   - Swagger UI at /docs (off in production unless SWAGGER_ENABLED=true)
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger as PinoLogger } from "nestjs-pino";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    })
  );

  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>("corsOrigins") ?? [];
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });
  app.enableShutdownHooks();

  const swaggerEnabled =
    config.get<string>("nodeEnv") !== "production" ||
    (config.get<boolean>("swaggerEnabled") ?? false);
  if (swaggerEnabled) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("OpenOffice Cloud API")
        .setDescription(
          "Org management + analytics behind managed sign-in (ADR 0005)"
        )
        .setVersion("0.1.0")
        .addBearerAuth()
        .build()
    );
    SwaggerModule.setup("docs", app, doc);
  }

  const port = config.get<number>("port") ?? 3001;
  await app.listen(port);
}

void bootstrap();
