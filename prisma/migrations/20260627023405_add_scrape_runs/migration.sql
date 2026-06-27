-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsRemoved" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ScrapeRun_sourceName_idx" ON "ScrapeRun"("sourceName");

-- CreateIndex
CREATE INDEX "ScrapeRun_sourceType_idx" ON "ScrapeRun"("sourceType");

-- CreateIndex
CREATE INDEX "ScrapeRun_status_idx" ON "ScrapeRun"("status");

-- CreateIndex
CREATE INDEX "ScrapeRun_startedAt_idx" ON "ScrapeRun"("startedAt");
