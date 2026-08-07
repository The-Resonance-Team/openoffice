import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import type { AuthenticatedMember } from "../strategies";
import { CurrentUser } from "../decorators";
import type { CreateApiKeyDto } from "../dto";
import { ApiKeyService } from "../services";

@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  /** Returns the raw key once — the caller must show it to the user now. */
  @Post()
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: AuthenticatedMember
  ) {
    const raw = await this.apiKeys.create(dto, user.userId, user.orgId);
    return { key: raw, orgId: user.orgId };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedMember) {
    return { keys: await this.apiKeys.list(user.userId, user.orgId) };
  }

  @Delete(":id")
  async revoke(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedMember
  ) {
    await this.apiKeys.revoke(user.userId, user.orgId, id);
    return { ok: true };
  }
}
