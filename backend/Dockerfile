# ──────────────────────────────────────────────
# Stage 1 – Build
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# Native addons (argon2) need build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install ALL dependencies (incl. dev) – cache-friendly layer
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate the client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the source and compile TypeScript
COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2 – Production image
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install openssl which is required for Prisma engines on Alpine,
# otherwise npx prisma generate/migrate deploy will fail with status 134
RUN apk add --no-cache openssl

WORKDIR /app

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy the full node_modules from builder (includes native .node binaries
# already compiled for this alpine version — avoids recompiling argon2)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema + migration files so `migrate deploy` can apply them
COPY --from=builder /app/prisma ./prisma

# Copy package.json (needed by Prisma CLI path resolution)
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["sh", "entrypoint.sh"]
