-- CreateTable
CREATE TABLE "Ball" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "coverstockName" TEXT,
    "coverstockType" TEXT NOT NULL,
    "coreName" TEXT,
    "coreType" TEXT NOT NULL,
    "factoryFinish" TEXT,
    "rg" REAL,
    "differential" REAL,
    "mbDifferential" REAL,
    "availableWeightsJson" TEXT,
    "officialUrl" TEXT,
    "imageUrl" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "removedFromLineupAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RetailerListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ballId" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "retailerType" TEXT NOT NULL,
    "listingTitle" TEXT NOT NULL,
    "listingUrl" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "matchConfidence" INTEGER NOT NULL,
    "matchStatus" TEXT NOT NULL,
    "currentPrice" REAL NOT NULL,
    "stockStatus" TEXT NOT NULL,
    "lastCheckedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetailerListing_ballId_fkey" FOREIGN KEY ("ballId") REFERENCES "Ball" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerListingId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "stockStatus" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_retailerListingId_fkey" FOREIGN KEY ("retailerListingId") REFERENCES "RetailerListing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ball_canonicalName_idx" ON "Ball"("canonicalName");

-- CreateIndex
CREATE INDEX "Ball_brand_idx" ON "Ball"("brand");

-- CreateIndex
CREATE INDEX "Ball_isCurrent_idx" ON "Ball"("isCurrent");

-- CreateIndex
CREATE INDEX "RetailerListing_ballId_idx" ON "RetailerListing"("ballId");

-- CreateIndex
CREATE INDEX "RetailerListing_retailerName_idx" ON "RetailerListing"("retailerName");

-- CreateIndex
CREATE INDEX "RetailerListing_stockStatus_idx" ON "RetailerListing"("stockStatus");

-- CreateIndex
CREATE INDEX "PriceSnapshot_retailerListingId_idx" ON "PriceSnapshot"("retailerListingId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_checkedAt_idx" ON "PriceSnapshot"("checkedAt");
