-- CreateTable
CREATE TABLE "TrackedRetailerSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxPages" INTEGER,
    "maxProducts" INTEGER,
    "scrapeDelayMs" INTEGER,
    "allowLikelyMatch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TrackedRetailerSource_retailerName_idx" ON "TrackedRetailerSource"("retailerName");

-- CreateIndex
CREATE INDEX "TrackedRetailerSource_sourceKind_idx" ON "TrackedRetailerSource"("sourceKind");

-- CreateIndex
CREATE INDEX "TrackedRetailerSource_enabled_idx" ON "TrackedRetailerSource"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedRetailerSource_retailerName_url_key" ON "TrackedRetailerSource"("retailerName", "url");
