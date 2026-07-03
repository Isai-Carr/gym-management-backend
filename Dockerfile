FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install all dependencies (dev included for build)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY . .
RUN npm run build

RUN mkdir -p storage/profiles storage/inventory storage/payments

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
