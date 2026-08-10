import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionRepo } from '@/auth/repo';

export interface SessionInfo {
  id: string;
  ip: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class SessionService {
  constructor(private readonly sessions: SessionRepo) {}

  async list(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const sessions = await this.sessions.findActiveByUserId(userId);
    return sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== userId || session.revokedAt) {
      throw new NotFoundException('Session not found');
    }
    await this.sessions.update(sessionId, { revokedAt: new Date() });
  }

  async revokeAllOthers(userId: string, currentSessionId: string): Promise<void> {
    await this.sessions.updateManyByUserIdExceptCurrent(userId, currentSessionId, {
      revokedAt: new Date(),
    });
  }
}
