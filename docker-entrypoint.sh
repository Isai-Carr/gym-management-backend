#!/bin/sh
set -eux

echo "===== START ====="

echo "Node version:"
node -v

echo "Current directory:"
pwd

echo "Listing dist:"
find dist || true

echo "Running Prisma migrate..."
npx prisma migrate deploy
echo "Prisma exit code: $?"

echo "Starting Node..."
exec node --trace-uncaught --trace-exit dist/src/main.js
