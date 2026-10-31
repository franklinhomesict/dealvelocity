# Acquisition OS — production image (amd64 + arm64, e.g. Oracle Cloud Ampere A1).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Apply pending migrations, then serve. Migrations are idempotent.
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx next start -p 3000 -H 0.0.0.0"]
