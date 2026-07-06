FROM node:20-alpine

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

ENTRYPOINT ["./docker-entrypoint.sh"]
