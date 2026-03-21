# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN npm install -g npm@11.4.2

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install ffmpeg and PySceneDetect with OpenCV backend
# py3-opencv from Alpine is pre-built for musl and handles video I/O including corrupt files
# pip must install scenedetect BEFORE py3-opencv is installed: Alpine's py3-opencv DIST-INFO
# contains version "python-4.12.0" (invalid PEP 440), which causes pip to crash mid-install.
RUN apk add --no-cache python3 py3-pip ffmpeg \
  && pip install --break-system-packages --root-user-action=ignore scenedetect \
  && pip cache purge \
  && rm -rf /root/.cache/pip \
  && apk add --no-cache py3-opencv

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
