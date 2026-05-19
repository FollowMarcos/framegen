# syntax=docker/dockerfile:1.6
#
# Multi-stage build for Frame.
#   1) deps      — install npm packages (sharp included; needs Linux glibc).
#   2) builder   — run `next build` against the full source tree.
#   3) runner    — copy only the standalone output + public/ + node_modules
#                  needed for sharp into a slim image.

FROM node:22-slim AS deps
WORKDIR /app
# sharp prebuilt binaries need libstdc++ / libc6 — both present in slim.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Skip telemetry chatter
ENV NEXT_TELEMETRY_DISABLED=1
# Optional build-time identifier surfaced in the UI version badge. The
# release workflow passes this as `--build-arg NEXT_PUBLIC_BUILD_SHA=<sha>`;
# local builds without the arg just get a blank SHA, which the badge hides.
ARG NEXT_PUBLIC_BUILD_SHA=""
ENV NEXT_PUBLIC_BUILD_SHA=$NEXT_PUBLIC_BUILD_SHA
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for runtime
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone server bundle + the public/ assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Sharp ships its own binary inside node_modules; the standalone copy already
# includes it from the tracing step.

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
