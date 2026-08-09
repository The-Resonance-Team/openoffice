# ---- Deps (cacheable — only invalidates on lockfile change) ----
FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /app

# Workspace package.json files — Bun needs all members for lockfile resolution
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/cloud-api/package.json ./apps/cloud-api/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/server/package.json ./packages/server/package.json

# Cache mount: Bun store persists across builds even when layer is invalidated
# Cold: ~10min → cached: ~30s (link only)
ENV CI=true
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ---- Prisma (cacheable — schema rarely changes) ----
FROM deps AS prisma
COPY apps/cloud-api/prisma ./apps/cloud-api/prisma
WORKDIR /app/apps/cloud-api
RUN bunx prisma generate
WORKDIR /app

# ---- Builder ----
FROM prisma AS builder
COPY apps/cloud-api ./apps/cloud-api
COPY packages ./packages
RUN bun run turbo run build --filter=cloud-api

# ---- Runner (prod-only) ----
FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app
RUN apk add --no-cache wget

# Workspace package.json files — Bun needs all for resolution
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/cloud-api/package.json ./apps/cloud-api/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY apps/cloud-api/prisma ./apps/cloud-api/prisma

# Install prod deps only — cache mount reuses Bun store from deps stage
# Cold: ~10min → cached: ~30s (link only from store)
ENV CI=true
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --prod

# Generate Prisma client in runner
WORKDIR /app/apps/cloud-api
RUN bunx prisma generate
WORKDIR /app

# Copy built application + workspace packages
COPY --from=builder /app/apps/cloud-api/dist ./apps/cloud-api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/protocol/dist ./packages/protocol/dist
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

ENV NODE_ENV=production
EXPOSE 5201

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5201/v1/health || exit 1

WORKDIR /app/apps/cloud-api
CMD ["bun", "run", "dist/main.js"]