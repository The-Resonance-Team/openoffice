// Prisma 7: connection URL lives here, not in schema.prisma.
// Local dev: docker compose up -d postgres (root docker-compose.yml).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
