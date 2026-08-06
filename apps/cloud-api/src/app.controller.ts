import { Controller, Get } from "@nestjs/common";

// Cloud backend (ADR 0005): NestJS + Postgres + OpenAuth.js on SST/AWS.
// The daemon (apps/cli) runs fully offline; this service is optional and
// talks to members' daemons only through the @openoffice/protocol contract
// (Cred Proxy, Cloud Config, Analytics — see cloud/CONTEXT.md).
@Controller()
export class AppController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }
}
