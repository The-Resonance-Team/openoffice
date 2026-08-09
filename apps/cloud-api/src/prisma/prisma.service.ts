import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/client'

// Lazy-connect by design: the client is created at construction, connections
// are opened on first query (health ping, feature queries) so unit tests and
// bootstraps never require a live database.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get<string>('databaseUrl'),
      }),
    })
  }

  onModuleDestroy(): void {
    void this.$disconnect()
  }
}
