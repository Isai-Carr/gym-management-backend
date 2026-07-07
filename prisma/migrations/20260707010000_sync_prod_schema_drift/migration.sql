-- Second batch of schema drift found via QA testing (see 20260707000000 for the
-- first). Generated from `prisma migrate diff --from-url <prod> --to-schema-datamodel
-- prisma/schema.prisma --script`, confirming production had drifted from
-- schema.prisma beyond just Client.emergencyContact:
--   - Class was missing activityId/instructorName entirely (POST/GET /classes
--     failed with P2022 in production)
--   - InventoryStatus/PaymentStatus enums still carried legacy values
--     (LOW_STOCK, OUT_OF_STOCK, MAINTENANCE, COMPLETED, FAILED) that schema.prisma
--     no longer declares
--   - Payment.paymentMethod was nullable in prod, non-null in schema
--   - Activity/PersonalRecord.updatedAt still had a DB-side default
--
-- Verified before writing this migration: 0 rows in Inventory, and the only 5
-- Payment rows in prod use APPROVED/REJECTED (not the enum values being
-- dropped), and none have a NULL paymentMethod — so this is safe to apply
-- as-is, no data to migrate off the removed enum values.

-- AlterEnum
BEGIN;
CREATE TYPE "InventoryStatus_new" AS ENUM ('AVAILABLE', 'IN_MAINTENANCE', 'DAMAGED', 'RETIRED');
ALTER TABLE "Inventory" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Inventory" ALTER COLUMN "status" TYPE "InventoryStatus_new" USING ("status"::text::"InventoryStatus_new");
ALTER TYPE "InventoryStatus" RENAME TO "InventoryStatus_old";
ALTER TYPE "InventoryStatus_new" RENAME TO "InventoryStatus";
DROP TYPE "InventoryStatus_old";
ALTER TABLE "Inventory" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "activityId" TEXT,
ADD COLUMN IF NOT EXISTS "instructorName" TEXT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" SET NOT NULL;

-- AlterTable
ALTER TABLE "PersonalRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Class_activityId_idx" ON "Class"("activityId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Class_activityId_fkey'
  ) THEN
    ALTER TABLE "Class" ADD CONSTRAINT "Class_activityId_fkey"
      FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
