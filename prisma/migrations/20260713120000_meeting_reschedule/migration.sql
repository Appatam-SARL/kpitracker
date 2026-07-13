-- CreateTable
CREATE TABLE "MeetingReschedule" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "previousDate" TIMESTAMP(3) NOT NULL,
    "newDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingReschedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingReschedule_activityId_createdAt_idx" ON "MeetingReschedule"("activityId", "createdAt");

-- AddForeignKey
ALTER TABLE "MeetingReschedule" ADD CONSTRAINT "MeetingReschedule_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingReschedule" ADD CONSTRAINT "MeetingReschedule_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
