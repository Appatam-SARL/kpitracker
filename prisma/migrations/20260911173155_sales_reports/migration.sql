-- CreateTable
CREATE TABLE "SalesReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "scopeLabel" TEXT,
    "payload" JSONB NOT NULL,
    "agentId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesReport_companyId_createdAt_idx" ON "SalesReport"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SalesReport_createdById_createdAt_idx" ON "SalesReport"("createdById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SalesReport_agentId_idx" ON "SalesReport"("agentId");

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
