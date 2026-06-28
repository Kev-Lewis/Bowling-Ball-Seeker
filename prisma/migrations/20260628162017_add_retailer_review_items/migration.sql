-- CreateTable
CREATE TABLE "RetailerReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailerName" TEXT NOT NULL,
    "retailerType" TEXT,
    "listingTitle" TEXT NOT NULL,
    "listingUrl" TEXT NOT NULL,
    "condition" TEXT,
    "scrapeStatus" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewReason" TEXT,
    "currentPrice" REAL,
    "stockStatus" TEXT,
    "selectedBallId" TEXT,
    "selectedBallName" TEXT,
    "selectedBrand" TEXT,
    "selectedCatalogState" TEXT,
    "selectedConfidence" INTEGER,
    "selectedMatchStatus" TEXT,
    "topMatchesJson" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RetailerReviewItem_listingUrl_key" ON "RetailerReviewItem"("listingUrl");

-- CreateIndex
CREATE INDEX "RetailerReviewItem_retailerName_idx" ON "RetailerReviewItem"("retailerName");

-- CreateIndex
CREATE INDEX "RetailerReviewItem_scrapeStatus_idx" ON "RetailerReviewItem"("scrapeStatus");

-- CreateIndex
CREATE INDEX "RetailerReviewItem_reviewStatus_idx" ON "RetailerReviewItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "RetailerReviewItem_reviewReason_idx" ON "RetailerReviewItem"("reviewReason");

-- CreateIndex
CREATE INDEX "RetailerReviewItem_lastSeenAt_idx" ON "RetailerReviewItem"("lastSeenAt");
