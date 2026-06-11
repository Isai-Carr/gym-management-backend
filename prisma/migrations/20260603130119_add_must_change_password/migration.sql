/*
  Warnings:

  - You are about to drop the `EquipmentMaintenance` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EquipmentMaintenance" DROP CONSTRAINT "EquipmentMaintenance_inventoryId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "EquipmentMaintenance";
