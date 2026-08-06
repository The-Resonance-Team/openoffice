import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Cloud backend (ADR 0005): NestJS + Postgres + OpenAuth.js on SST/AWS.
// The daemon (apps/cli) runs fully offline; this service is optional and
// talks to members' daemons only through the @openoffice/protocol contract.
const port = Number(process.env.CLOUD_API_PORT ?? 3001);

const app = await NestFactory.create(AppModule);
await app.listen(port);
console.log(`cloud-api listening on :${port}`);
