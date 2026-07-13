-- AlterTable
ALTER TABLE "AgendaItem" ADD COLUMN "activityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AgendaItem_activityId_key" ON "AgendaItem"("activityId");

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
