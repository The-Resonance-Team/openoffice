import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateApiKeyDto } from '@/auth/dto';
import type { ApiKeyListItem, ApiKeyPrincipal } from './api-key.type';
import { randomToken, sha256Hex } from './tokens';

/** The principal a Daemon API Key resolves to — same shape as the JWT user. */
@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a key bound to one Org and returns the raw key — the only time
   * it is ever visible. sha256 at rest: keys are high-entropy randoms,
   * verified on every daemon request, so argon2 would be needlessly slow.
   */
  async create(dto: CreateApiKeyDto, userId: string, orgId: string): Promise<string> {
    const raw = `oo_live_${randomToken()}`;
    await this.prisma.apiKey.create({
      data: {
        userId,
        orgId,
        name: dto.name,
        keyPrefix: raw.slice(0, 14),
        keyHash: sha256Hex(raw),
      },
    });
    return raw;
  }

  /** Keys of this user within the session's Org — a two-org member's
   *  session never sees the other org's keys. */
  async list(userId: string, orgId: string): Promise<ApiKeyListItem[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId, orgId, revokedAt: null },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      createdAt: k.createdAt,
    }));
  }

  /** Revokes a key; scoped to caller + session org so others' keys are untouchable. */
  async revoke(userId: string, orgId: string, keyId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id: keyId, userId, orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Resolves a raw key to its principal, or null when unknown/revoked/left. */
  async verify(rawKey: string): Promise<ApiKeyPrincipal | null> {
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: sha256Hex(rawKey) },
    });
    if (!key || key.revokedAt) return null;
    const membership = await this.prisma.member.findFirst({
      where: { userId: key.userId, orgId: key.orgId },
    });
    if (!membership) return null;
    return {
      keyId: key.id,
      userId: key.userId,
      memberId: membership.id,
      orgId: key.orgId,
      role: membership.role,
    };
  }

  /** Throwing variant for the passport strategy. */
  async authenticate(rawKey: string): Promise<ApiKeyPrincipal> {
    const principal = await this.verify(rawKey);
    if (!principal) throw new UnauthorizedException('Invalid API key');
    return principal;
  }
}
