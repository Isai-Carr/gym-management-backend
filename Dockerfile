FROM node:20-alpine

# Real PID 1 with proper signal forwarding and zombie reaping — running a shell
# script directly as PID 1 (as before) can silently swallow signals/exit codes
# from child processes like `npx prisma migrate deploy`.
RUN apk add --no-cache tini

WORKDIR /app

# Install all dependencies (dev included so nest CLI is available for build)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate
RUN ls node_modules/.prisma

# Copy source and build
COPY . .
RUN npm run build
RUN ls -R dist

RUN mkdir -p storage/profiles storage/inventory storage/payments storage/uploads

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
