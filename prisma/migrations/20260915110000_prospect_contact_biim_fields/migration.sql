-- AlterTable
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "biimDocument" TEXT;
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "biimRegistered" BOOLEAN;
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "biimVisited" BOOLEAN;
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "biimApproved" BOOLEAN;
