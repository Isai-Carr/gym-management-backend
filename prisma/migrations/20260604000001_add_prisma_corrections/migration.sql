-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'TERMINAL');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- AlterTable: Membership — add status field
ALTER TABLE "Membership" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable: Inventory — add imageUrl field
ALTER TABLE "Inventory" ADD COLUMN "imageUrl" TEXT;

-- AlterTable: Payment — add voucherUrl, replace paymentMethod String with PaymentMethod enum
ALTER TABLE "Payment" ADD COLUMN "voucherUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "paymentMethodNew" "PaymentMethod";
UPDATE "Payment"
  SET "paymentMethodNew" = "paymentMethod"::"PaymentMethod"
  WHERE "paymentMethod" IN ('CASH', 'TRANSFER', 'TERMINAL');
ALTER TABLE "Payment" DROP COLUMN "paymentMethod";
ALTER TABLE "Payment" RENAME COLUMN "paymentMethodNew" TO "paymentMethod";
