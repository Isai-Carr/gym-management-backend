-- Schema drift fix: `emergencyContact` was added to schema.prisma without ever
-- generating a migration (likely applied to a dev DB via `prisma db push`),
-- so `prisma migrate deploy` never created it in production. Any query that
-- includes the Client relation (login, register, profile, ...) was failing
-- in production with Prisma error P2022 "column does not exist".
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
