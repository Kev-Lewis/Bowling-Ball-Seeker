-- CreateTable
CREATE TABLE "LineupEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ballId" TEXT,
    "eventType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "detectedAt" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineupEvent_ballId_fkey" FOREIGN KEY ("ballId") REFERENCES "Ball" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LineupEvent_ballId_idx" ON "LineupEvent"("ballId");

-- CreateIndex
CREATE INDEX "LineupEvent_eventType_idx" ON "LineupEvent"("eventType");

-- CreateIndex
CREATE INDEX "LineupEvent_detectedAt_idx" ON "LineupEvent"("detectedAt");
