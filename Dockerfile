# Use node:20-alpine as the base image
FROM node:20-alpine AS base

# Install pnpm and dependencies for building
RUN npm install -g pnpm
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy project files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy production artifacts from base
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/server.ts ./server.ts
COPY --from=base /app/lib ./lib
COPY --from=base /app/app ./app
COPY --from=base /app/tsconfig.json ./
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/next.config.mjs ./next.config.mjs

# Install tsx globally to run the custom server
RUN npm install -g tsx

# Expose the application port
EXPOSE 3000

# Environment variables (filled at runtime by docker-compose)
ENV NODE_ENV=production

# Start the custom server
CMD ["tsx", "server.ts"]
