# Build from the REPOSITORY ROOT — the app's @maets/* deps are sibling
# workspaces: docker build -f next/Dockerfile .

# 1. Install dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY next/package.json ./next/
COPY maets-game-sync/package.json ./maets-game-sync/
COPY maets-games/package.json ./maets-games/
RUN npm ci

# 2. Build the app
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they
# must be present here (pass with `docker build --build-arg NAME=value`).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace maets

# Stage sharp's libvips package (see the runner stage for why it is needed) under
# a fixed path, keeping its own directory name. The name carries the arch, so
# this lets the runner copy it without hardcoding x64 vs arm64. A glob that
# matches nothing fails the build here, which beats shipping a broken image.
RUN mkdir -p /sharp-libvips \
 && cp -R /app/node_modules/@img/sharp-libvips-linuxmusl-* /sharp-libvips/

# 3. Minimal runtime image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone bundle = server.js + a pruned node_modules, nested under next/
# because the tracing root is the workspace root (see next.config.ts)
COPY --from=builder /app/next/.next/standalone ./
# static assets and public/ aren't part of the standalone bundle by default
COPY --from=builder /app/next/.next/static ./next/.next/static
COPY --from=builder /app/next/public ./next/public

# On musl, sharp splits across two packages: @img/sharp-linuxmusl-<arch> holds
# the .node binary and @img/sharp-libvips-linuxmusl-<arch> holds libvips-cpp.so.
# The tracer follows require() calls, so it copies the first and misses the
# second: the .so is referenced only by the compiled binary's dynamic link table.
# It resolves the .so via an rpath relative to its own location, so the package
# has to land beside sharp-linuxmusl-<arch> under its exact directory name.
# Without this the server action importing sharp fails with ERR_DLOPEN_FAILED.
COPY --from=builder /sharp-libvips/ ./node_modules/@img/

USER nextjs
EXPOSE 3000
CMD ["node", "next/server.js"]
