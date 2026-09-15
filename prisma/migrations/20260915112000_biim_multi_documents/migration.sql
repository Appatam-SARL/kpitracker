-- AlterTable ProspectContact: biimDocument -> biimDocuments (JSON array)
ALTER TABLE "ProspectContact" ADD COLUMN IF NOT EXISTS "biimDocuments" JSONB;

UPDATE "ProspectContact"
SET "biimDocuments" = jsonb_build_array("biimDocument")
WHERE "biimDocument" IS NOT NULL
  AND "biimDocument" <> ''
  AND ("biimDocuments" IS NULL OR "biimDocuments" = 'null'::jsonb);

ALTER TABLE "ProspectContact" DROP COLUMN IF EXISTS "biimDocument";

-- AlterTable ProspectAttachment: contact + label
ALTER TABLE "ProspectAttachment" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "ProspectAttachment" ADD COLUMN IF NOT EXISTS "label" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProspectAttachment_contactId_fkey'
  ) THEN
    ALTER TABLE "ProspectAttachment"
      ADD CONSTRAINT "ProspectAttachment_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "ProspectContact"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProspectAttachment_contactId_deletedAt_idx"
  ON "ProspectAttachment"("contactId", "deletedAt");
