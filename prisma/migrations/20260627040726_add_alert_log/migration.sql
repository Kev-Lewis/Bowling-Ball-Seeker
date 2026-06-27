-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dedupeKey" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "destinationId" TEXT,
    "destinationKey" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "ballId" TEXT,
    "retailerListingId" TEXT,
    "message" TEXT NOT NULL,
    "payloadJson" TEXT,
    "sentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AlertLog_alertType_idx" ON "AlertLog"("alertType");

-- CreateIndex
CREATE INDEX "AlertLog_ballId_idx" ON "AlertLog"("ballId");

-- CreateIndex
CREATE INDEX "AlertLog_retailerListingId_idx" ON "AlertLog"("retailerListingId");

-- CreateIndex
CREATE INDEX "AlertLog_destinationType_idx" ON "AlertLog"("destinationType");

-- CreateIndex
CREATE INDEX "AlertLog_sentAt_idx" ON "AlertLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertLog_dedupeKey_destinationKey_key" ON "AlertLog"("dedupeKey", "destinationKey");
