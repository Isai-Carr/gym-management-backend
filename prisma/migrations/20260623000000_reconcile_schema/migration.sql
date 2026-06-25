-- ============================================================
-- MIGRATION: reconcile_schema
-- Applied via prisma db push — this file documents the state.
-- The DB was already in sync when this was baselined.
-- ============================================================

-- PaymentStatus: COMPLETED/FAILED → APPROVED/REJECTED
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- InventoryStatus: legacy values → new values
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'IN_MAINTENANCE';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'DAMAGED';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'RETIRED';

-- NotificationType enum
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'EXPIRY_WARNING', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- WeightUnit enum
DO $$ BEGIN
  CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User: new columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ALTER COLUMN "mustChangePassword" SET DEFAULT false;

-- Client: new columns
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "address"   TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Payment: new columns + type change
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "clientId"   TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "notes"      TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE NUMERIC(10,2) USING "amount"::NUMERIC(10,2);

-- Notification: type column
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" "NotificationType" NOT NULL DEFAULT 'INFO';

-- Inventory: new columns + type change
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "category"             TEXT;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "purchaseDate"         TIMESTAMP(3);
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "maintenanceRequired"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "notes"                TEXT;
ALTER TABLE "Inventory" ALTER COLUMN "price" TYPE NUMERIC(10,2) USING "price"::NUMERIC(10,2);

-- MembershipPlan: type change
ALTER TABLE "MembershipPlan" ALTER COLUMN "price" TYPE NUMERIC(10,2) USING "price"::NUMERIC(10,2);

-- Membership: activityId
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "activityId" TEXT;

-- Attendance: activityId
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "activityId" TEXT;

-- Activity table
CREATE TABLE IF NOT EXISTS "Activity" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Activity_name_key" ON "Activity"("name");

-- PersonalRecord table
CREATE TABLE IF NOT EXISTS "PersonalRecord" (
    "id"         TEXT         NOT NULL,
    "clientId"   TEXT         NOT NULL,
    "exercise"   TEXT         NOT NULL,
    "weight"     NUMERIC(8,3) NOT NULL,
    "unit"       "WeightUnit" NOT NULL DEFAULT 'KG',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- FK constraints
ALTER TABLE "PersonalRecord"
  ADD CONSTRAINT "PersonalRecord_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recreate RefreshToken FK with CASCADE
ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_userId_fkey";
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "Membership_clientId_status_endDate_idx" ON "Membership"("clientId", "status", "endDate");
CREATE INDEX IF NOT EXISTS "Membership_planId_idx"     ON "Membership"("planId");
CREATE INDEX IF NOT EXISTS "Membership_activityId_idx" ON "Membership"("activityId");
CREATE INDEX IF NOT EXISTS "Attendance_activityId_idx" ON "Attendance"("activityId");
CREATE INDEX IF NOT EXISTS "Attendance_checkIn_idx"    ON "Attendance"("checkIn");
CREATE INDEX IF NOT EXISTS "Attendance_clientId_idx"   ON "Attendance"("clientId");
CREATE INDEX IF NOT EXISTS "Reservation_classId_idx"   ON "Reservation"("classId");
CREATE INDEX IF NOT EXISTS "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");
CREATE INDEX IF NOT EXISTS "Payment_clientId_idx"      ON "Payment"("clientId");
CREATE INDEX IF NOT EXISTS "Payment_membershipId_idx"  ON "Payment"("membershipId");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx"  ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"         ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "PersonalRecord_clientId_idx"    ON "PersonalRecord"("clientId");
CREATE INDEX IF NOT EXISTS "PersonalRecord_exercise_idx"    ON "PersonalRecord"("exercise");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx"        ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx"   ON "PasswordResetToken"("email");
CREATE INDEX IF NOT EXISTS "Client_firstName_lastName_idx"  ON "Client"("firstName", "lastName");
CREATE INDEX IF NOT EXISTS "Client_userId_idx"              ON "Client"("userId");
CREATE INDEX IF NOT EXISTS "User_isActive_idx"              ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "User_role_idx"                  ON "User"("role");
CREATE INDEX IF NOT EXISTS "Inventory_status_idx"           ON "Inventory"("status");
CREATE INDEX IF NOT EXISTS "Inventory_type_idx"             ON "Inventory"("type");
CREATE INDEX IF NOT EXISTS "Membership_endDate_idx"         ON "Membership"("endDate");
CREATE INDEX IF NOT EXISTS "Membership_status_idx"          ON "Membership"("status");
