-- CreateEnum
CREATE TYPE "NegotiationStage" AS ENUM ('EN_PROSPECTION', 'VENTE_CONCLUE', 'VENTE_PERDUE');

-- ProspectContact.negotiationStage
ALTER TABLE "ProspectContact"
ADD COLUMN "negotiationStage" "NegotiationStage" NOT NULL DEFAULT 'EN_PROSPECTION';

UPDATE "ProspectContact" AS pc
SET "negotiationStage" = CASE p.status::text
  WHEN 'CONVERTED' THEN 'VENTE_CONCLUE'::"NegotiationStage"
  WHEN 'LOST' THEN 'VENTE_PERDUE'::"NegotiationStage"
  ELSE 'EN_PROSPECTION'::"NegotiationStage"
END
FROM "Prospect" AS p
WHERE pc."prospectId" = p.id;

CREATE INDEX "ProspectContact_negotiationStage_idx" ON "ProspectContact"("negotiationStage");

-- Prospect.status: LeadStatus → NegotiationStage
ALTER TABLE "Prospect" ADD COLUMN "status_new" "NegotiationStage" NOT NULL DEFAULT 'EN_PROSPECTION';

UPDATE "Prospect"
SET "status_new" = CASE status::text
  WHEN 'CONVERTED' THEN 'VENTE_CONCLUE'::"NegotiationStage"
  WHEN 'LOST' THEN 'VENTE_PERDUE'::"NegotiationStage"
  ELSE 'EN_PROSPECTION'::"NegotiationStage"
END;

ALTER TABLE "Prospect" DROP COLUMN "status";
ALTER TABLE "Prospect" RENAME COLUMN "status_new" TO "status";

CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

DROP TYPE "LeadStatus";
