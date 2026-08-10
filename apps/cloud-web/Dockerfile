# ---- Deps (cacheable — only invalidates on lockfile change) ----
FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /app

# Workspace package.json files — Bun needs all members for lockfile resolution
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/cloud-api/package.json ./apps/cloud-api/package.json
COPY apps/cloud-web/package.json ./apps/cloud-web/package.json
COPY apps/desktop/package.json ./apps/desktop/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/server/package.json ./packages/server/package.json

# Cache mount: Bun store persists across builds even when layer is invalidated
# Cold: ~10min → cached: ~30s (link only)
ENV CI=true
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ---- Builder ----
FROM deps AS builder
WORKDIR /app

# NEXT_PUBLIC_* must be baked at build time (Next.js standalone)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY apps/cloud-web ./apps/cloud-web
COPY packages ./packages

# Build cloud-web app
RUN bun run turbo run build --filter=cloud-web

# ---- Runner ----
FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# NEXT_PUBLIC_* must be available at runtime for SSR (Next.js standalone reads process.env)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN apk add --no-cache wget

# Copy standalone output
COPY --from=builder /app/apps/cloud-web/.next/standalone ./
COPY --from=builder /app/apps/cloud-web/.next/static ./apps/cloud-web/.next/static
COPY --from=builder /app/apps/cloud-web/public ./apps/cloud-web/public

EXPOSE 5202

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5202/ || exit 1

CMD ["bun", "run", "apps/cloud-web/server.js"]