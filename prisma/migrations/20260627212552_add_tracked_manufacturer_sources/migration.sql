-- CreateTable
CREATE TABLE "TrackedManufacturerSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "manufacturerName" TEXT NOT NULL,
    "brandName" TEXT,
    "sourceKind" TEXT NOT NULL,
    "parserKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxPages" INTEGER,
    "maxProducts" INTEGER,
    "scrapeDelayMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TrackedManufacturerSource_manufacturerName_idx" ON "TrackedManufacturerSource"("manufacturerName");

-- CreateIndex
CREATE INDEX "TrackedManufacturerSource_brandName_idx" ON "TrackedManufacturerSource"("brandName");

-- CreateIndex
CREATE INDEX "TrackedManufacturerSource_sourceKind_idx" ON "TrackedManufacturerSource"("sourceKind");

-- CreateIndex
CREATE INDEX "TrackedManufacturerSource_parserKey_idx" ON "TrackedManufacturerSource"("parserKey");

-- CreateIndex
CREATE INDEX "TrackedManufacturerSource_enabled_idx" ON "TrackedManufacturerSource"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedManufacturerSource_manufacturerName_url_key" ON "TrackedManufacturerSource"("manufacturerName", "url");
