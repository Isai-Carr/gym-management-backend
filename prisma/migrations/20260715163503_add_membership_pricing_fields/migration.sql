-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "months" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "baseAmount" DECIMAL(10,2),
ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "months" INTEGER;
