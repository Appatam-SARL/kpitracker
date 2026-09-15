-- Prospects entreprise GROUP : création tables + backfill depuis Lead, puis suppression Lead

-- 1) Nouvelles tables
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "source" TEXT,
    "activitySector" TEXT,
    "leadType" "LeadTypeClient" NOT NULL DEFAULT 'NON_DETERMINE',
    "location" TEXT,
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectContact" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "civility" TEXT,
    "jobTitle" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    CONSTRAINT "ProspectContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectActivityDomain" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    CONSTRAINT "ProspectActivityDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectProductInterest" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "customName" TEXT,
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectProductInterest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectServiceInterest" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "customName" TEXT,
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectServiceInterest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectAttachment" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    CONSTRAINT "ProspectAttachment_pkey" PRIMARY KEY ("id")
);

-- Mapping temporaire Lead.id -> Contact.id / Prospect.id
CREATE TEMP TABLE "_lead_map" (
    "leadId" TEXT PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL
);

CREATE TEMP TABLE "_prospect_by_norm" (
    "nameNormalized" TEXT PRIMARY KEY,
    "prospectId" TEXT NOT NULL
);

-- 2) Créer les Prospects (1 par nom normalisé)
INSERT INTO "Prospect" (
  "id", "name", "nameNormalized", "source", "activitySector", "leadType",
  "location", "notes", "status", "createdAt", "updatedAt", "deletedAt", "deletedById"
)
SELECT
  md5('prospect:' || norm) AS id,
  display_name,
  norm,
  source,
  activity_sector,
  lead_type,
  location,
  notes,
  status,
  created_at,
  NOW(),
  deleted_at,
  deleted_by
FROM (
  SELECT
    lower(trim(both FROM regexp_replace(
      translate(
        coalesce(nullif(trim("companyName"), ''), 'Sans nom'),
        'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñŸÿ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYy'
      ),
      '\s+', ' ', 'g'
    ))) AS norm,
    (array_agg(coalesce(nullif(trim("companyName"), ''), 'Sans nom') ORDER BY "createdAt"))[1] AS display_name,
    (array_agg("source" ORDER BY "createdAt"))[1] AS source,
    (array_agg("activitySector" ORDER BY "createdAt"))[1] AS activity_sector,
    (array_agg("leadType" ORDER BY "createdAt"))[1] AS lead_type,
    (array_agg("location" ORDER BY "createdAt"))[1] AS location,
    (array_agg("notes" ORDER BY "createdAt"))[1] AS notes,
    (array_agg("status" ORDER BY "createdAt"))[1] AS status,
    min("createdAt") AS created_at,
    CASE WHEN bool_or("deletedAt" IS NOT NULL) AND bool_and("deletedAt" IS NOT NULL)
      THEN max("deletedAt") ELSE NULL END AS deleted_at,
    (array_agg("deletedById" ORDER BY "createdAt") FILTER (WHERE "deletedById" IS NOT NULL))[1] AS deleted_by
  FROM "Lead"
  GROUP BY 1
) s;

INSERT INTO "_prospect_by_norm" ("nameNormalized", "prospectId")
SELECT "nameNormalized", "id" FROM "Prospect";

-- 3) Contacts (1 par Lead)
INSERT INTO "ProspectContact" (
  "id", "prospectId", "createdById", "firstName", "lastName", "phone", "email",
  "civility", "jobTitle", "notes", "createdAt", "updatedAt", "deletedAt", "deletedById"
)
SELECT
  l."id" AS id,
  p."prospectId",
  coalesce(nullif(l."assignedTo", ''), l."companyId") AS created_by_placeholder,
  l."firstName",
  l."lastName",
  l."phone",
  l."email",
  l."civility",
  l."jobTitle",
  NULL,
  l."createdAt",
  l."createdAt",
  l."deletedAt",
  l."deletedById"
FROM "Lead" l
JOIN "_prospect_by_norm" p ON p."nameNormalized" = lower(trim(both FROM regexp_replace(
  translate(
    coalesce(nullif(trim(l."companyName"), ''), 'Sans nom'),
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñŸÿ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYy'
  ),
  '\s+', ' ', 'g'
)));

-- Corriger createdById : préférer assignedTo s'il existe en User, sinon un user de la company du lead
UPDATE "ProspectContact" pc
SET "createdById" = coalesce(
  (SELECT u."id" FROM "User" u WHERE u."id" = (
    SELECT l."assignedTo" FROM "Lead" l WHERE l."id" = pc."id"
  ) LIMIT 1),
  (SELECT u."id" FROM "User" u
   JOIN "Lead" l ON l."id" = pc."id"
   WHERE u."companyId" = l."companyId"
   ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 WHEN u."role" = 'MANAGER' THEN 1 ELSE 2 END, u."createdAt"
   LIMIT 1)
);

-- Si toujours invalide, supprimer contacts orphelins (edge case DB vide users)
DELETE FROM "ProspectContact" pc
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = pc."createdById");

INSERT INTO "_lead_map" ("leadId", "prospectId", "contactId", "userId")
SELECT l."id", pc."prospectId", pc."id", pc."createdById"
FROM "Lead" l
JOIN "ProspectContact" pc ON pc."id" = l."id";

-- 4) Domaines d'activité
INSERT INTO "ProspectActivityDomain" ("id", "prospectId", "domain")
SELECT md5(m."prospectId" || ':' || d."domain"), m."prospectId", d."domain"
FROM "LeadActivityDomain" d
JOIN "_lead_map" m ON m."leadId" = d."leadId";

DELETE FROM "ProspectActivityDomain" a
USING "ProspectActivityDomain" b
WHERE a."prospectId" = b."prospectId" AND a."domain" = b."domain" AND a."id" > b."id";

-- 5) Intérêts
INSERT INTO "ProspectProductInterest" ("id", "contactId", "userId", "productId", "customName", "estimatedValue", "createdAt")
SELECT i."id", m."contactId", m."userId", i."productId", i."customName", i."estimatedValue", i."createdAt"
FROM "LeadProductInterest" i
JOIN "_lead_map" m ON m."leadId" = i."leadId";

INSERT INTO "ProspectServiceInterest" ("id", "contactId", "userId", "serviceId", "customName", "estimatedValue", "createdAt")
SELECT i."id", m."contactId", m."userId", i."serviceId", i."customName", i."estimatedValue", i."createdAt"
FROM "LeadServiceInterest" i
JOIN "_lead_map" m ON m."leadId" = i."leadId";

-- 6) Pièces jointes
INSERT INTO "ProspectAttachment" ("id", "prospectId", "fileName", "fileType", "fileSize", "storagePath", "createdAt", "deletedAt", "deletedById")
SELECT a."id", m."prospectId", a."fileName", a."fileType", a."fileSize", a."storagePath", a."createdAt", a."deletedAt", a."deletedById"
FROM "LeadAttachment" a
JOIN "_lead_map" m ON m."leadId" = a."leadId";

-- 7) Activity : ajouter colonnes, backfill, drop leadId
ALTER TABLE "Activity" ADD COLUMN "prospectId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "contactId" TEXT;

UPDATE "Activity" act
SET
  "prospectId" = m."prospectId",
  "contactId" = m."contactId"
FROM "_lead_map" m
WHERE act."leadId" = m."leadId";

ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_leadId_fkey";
ALTER TABLE "Activity" DROP COLUMN "leadId";

-- 8) AgendaItem
ALTER TABLE "AgendaItem" ADD COLUMN "prospectId" TEXT;
ALTER TABLE "AgendaItem" ADD COLUMN "contactId" TEXT;

UPDATE "AgendaItem" ag
SET
  "prospectId" = m."prospectId",
  "contactId" = m."contactId"
FROM "_lead_map" m
WHERE ag."leadId" = m."leadId";

-- Orphelins : rattacher à un prospect placeholder ou supprimer
DELETE FROM "AgendaItem" WHERE "prospectId" IS NULL;

ALTER TABLE "AgendaItem" DROP CONSTRAINT IF EXISTS "AgendaItem_leadId_fkey";
ALTER TABLE "AgendaItem" DROP COLUMN "leadId";
ALTER TABLE "AgendaItem" ALTER COLUMN "prospectId" SET NOT NULL;

-- 9) Client lien optionnel
ALTER TABLE "Client" ADD COLUMN "convertedFromProspectId" TEXT;

-- 10) Indexes & FK Prospect*
CREATE UNIQUE INDEX "Prospect_nameNormalized_key" ON "Prospect"("nameNormalized");
CREATE INDEX "Prospect_deletedAt_idx" ON "Prospect"("deletedAt");
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

CREATE INDEX "ProspectContact_prospectId_deletedAt_idx" ON "ProspectContact"("prospectId", "deletedAt");
CREATE INDEX "ProspectContact_createdById_idx" ON "ProspectContact"("createdById");

CREATE UNIQUE INDEX "ProspectActivityDomain_prospectId_domain_key" ON "ProspectActivityDomain"("prospectId", "domain");
CREATE INDEX "ProspectActivityDomain_domain_idx" ON "ProspectActivityDomain"("domain");

CREATE UNIQUE INDEX "ProspectProductInterest_contactId_userId_productId_key" ON "ProspectProductInterest"("contactId", "userId", "productId");
CREATE UNIQUE INDEX "ProspectProductInterest_contactId_userId_customName_key" ON "ProspectProductInterest"("contactId", "userId", "customName");
CREATE INDEX "ProspectProductInterest_userId_idx" ON "ProspectProductInterest"("userId");

CREATE UNIQUE INDEX "ProspectServiceInterest_contactId_userId_serviceId_key" ON "ProspectServiceInterest"("contactId", "userId", "serviceId");
CREATE UNIQUE INDEX "ProspectServiceInterest_contactId_userId_customName_key" ON "ProspectServiceInterest"("contactId", "userId", "customName");
CREATE INDEX "ProspectServiceInterest_userId_idx" ON "ProspectServiceInterest"("userId");

CREATE INDEX "ProspectAttachment_prospectId_deletedAt_idx" ON "ProspectAttachment"("prospectId", "deletedAt");
CREATE INDEX "Activity_prospectId_idx" ON "Activity"("prospectId");
CREATE INDEX "Activity_contactId_idx" ON "Activity"("contactId");
CREATE INDEX "AgendaItem_prospectId_idx" ON "AgendaItem"("prospectId");
CREATE INDEX "AgendaItem_contactId_idx" ON "AgendaItem"("contactId");

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectActivityDomain" ADD CONSTRAINT "ProspectActivityDomain_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectProductInterest" ADD CONSTRAINT "ProspectProductInterest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ProspectContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectProductInterest" ADD CONSTRAINT "ProspectProductInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectProductInterest" ADD CONSTRAINT "ProspectProductInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectServiceInterest" ADD CONSTRAINT "ProspectServiceInterest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ProspectContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectServiceInterest" ADD CONSTRAINT "ProspectServiceInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectServiceInterest" ADD CONSTRAINT "ProspectServiceInterest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectAttachment" ADD CONSTRAINT "ProspectAttachment_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectAttachment" ADD CONSTRAINT "ProspectAttachment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ProspectContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ProspectContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11) Drop anciennes tables Lead*
ALTER TABLE "LeadActivityDomain" DROP CONSTRAINT IF EXISTS "LeadActivityDomain_leadId_fkey";
ALTER TABLE "LeadAttachment" DROP CONSTRAINT IF EXISTS "LeadAttachment_leadId_fkey";
ALTER TABLE "LeadAttachment" DROP CONSTRAINT IF EXISTS "LeadAttachment_deletedById_fkey";
ALTER TABLE "LeadProductInterest" DROP CONSTRAINT IF EXISTS "LeadProductInterest_leadId_fkey";
ALTER TABLE "LeadProductInterest" DROP CONSTRAINT IF EXISTS "LeadProductInterest_productId_fkey";
ALTER TABLE "LeadServiceInterest" DROP CONSTRAINT IF EXISTS "LeadServiceInterest_leadId_fkey";
ALTER TABLE "LeadServiceInterest" DROP CONSTRAINT IF EXISTS "LeadServiceInterest_serviceId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_companyId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_deletedById_fkey";
ALTER TABLE "_LeadProducts" DROP CONSTRAINT IF EXISTS "_LeadProducts_A_fkey";
ALTER TABLE "_LeadProducts" DROP CONSTRAINT IF EXISTS "_LeadProducts_B_fkey";
ALTER TABLE "_LeadServices" DROP CONSTRAINT IF EXISTS "_LeadServices_A_fkey";
ALTER TABLE "_LeadServices" DROP CONSTRAINT IF EXISTS "_LeadServices_B_fkey";

DROP TABLE IF EXISTS "_LeadProducts";
DROP TABLE IF EXISTS "_LeadServices";
DROP TABLE IF EXISTS "LeadActivityDomain";
DROP TABLE IF EXISTS "LeadAttachment";
DROP TABLE IF EXISTS "LeadProductInterest";
DROP TABLE IF EXISTS "LeadServiceInterest";
DROP TABLE IF EXISTS "Lead";
