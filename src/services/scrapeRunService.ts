import { randomUUID } from "crypto";
import { prisma } from "../db/prisma";

interface StartScrapeRunInput {
  sourceName: string;
  sourceType: string;
  metadata?: Record<string, unknown>;
}

interface CompleteScrapeRunInput {
  itemsFound?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsRemoved?: number;
  metadata?: Record<string, unknown>;
}

function stringifyMetadata(metadata?: Record<string, unknown>) {
  return metadata ? JSON.stringify(metadata) : null;
}

export async function startScrapeRun(input: StartScrapeRunInput) {
  return prisma.scrapeRun.create({
    data: {
      id: randomUUID(),
      sourceName: input.sourceName,
      sourceType: input.sourceType,
      status: "running",
      startedAt: new Date(),
      metadataJson: stringifyMetadata(input.metadata),
    },
  });
}

export async function completeScrapeRun(
  scrapeRunId: string,
  input: CompleteScrapeRunInput
) {
  return prisma.scrapeRun.update({
    where: {
      id: scrapeRunId,
    },
    data: {
      status: "success",
      finishedAt: new Date(),
      itemsFound: input.itemsFound ?? 0,
      itemsCreated: input.itemsCreated ?? 0,
      itemsUpdated: input.itemsUpdated ?? 0,
      itemsRemoved: input.itemsRemoved ?? 0,
      metadataJson: stringifyMetadata(input.metadata),
    },
  });
}

export async function failScrapeRun(
  scrapeRunId: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
) {
  return prisma.scrapeRun.update({
    where: {
      id: scrapeRunId,
    },
    data: {
      status: "failed",
      finishedAt: new Date(),
      errorMessage,
      metadataJson: stringifyMetadata(metadata),
    },
  });
}

export async function getRecentScrapeRuns(limit = 50) {
  return prisma.scrapeRun.findMany({
    take: limit,
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getScrapeRunsByStatus(status: string, limit = 50) {
  return prisma.scrapeRun.findMany({
    where: {
      status,
    },
    take: limit,
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getScrapeRunsBySourceType(sourceType: string, limit = 50) {
  return prisma.scrapeRun.findMany({
    where: {
      sourceType,
    },
    take: limit,
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getLatestScrapeRunForSource(
  sourceName: string,
  sourceType?: string
) {
  return prisma.scrapeRun.findFirst({
    where: {
      sourceName,
      ...(sourceType ? { sourceType } : {}),
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getLatestScrapeRunsBySource(sourceType?: string) {
  const runs = await prisma.scrapeRun.findMany({
    where: {
      ...(sourceType ? { sourceType } : {}),
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  const latestBySource = new Map<string, (typeof runs)[number]>();

  for (const run of runs) {
    const key = `${run.sourceName}:${run.sourceType}`;

    if (!latestBySource.has(key)) {
      latestBySource.set(key, run);
    }
  }

  return Array.from(latestBySource.values()).sort((a, b) => {
    return a.sourceName.localeCompare(b.sourceName);
  });
}

export async function getManufacturerCatalogSyncStatus() {
  const latestRuns = await getLatestScrapeRunsBySource(
    "manufacturer_catalog_live_sync"
  );

  return {
    sourceType: "manufacturer_catalog_live_sync",
    count: latestRuns.length,
    data: latestRuns.map((run) => ({
      sourceName: run.sourceName,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      itemsFound: run.itemsFound,
      itemsCreated: run.itemsCreated,
      itemsUpdated: run.itemsUpdated,
      itemsRemoved: run.itemsRemoved,
      errorMessage: run.errorMessage,
      metadataJson: run.metadataJson,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function getRetailerPriceScrapeStatus() {
  const latestRuns = await getLatestScrapeRunsBySource(
    "retailer_price_scrape"
  );

  return {
    sourceType: "retailer_price_scrape",
    count: latestRuns.length,
    data: latestRuns.map((run) => ({
      sourceName: run.sourceName,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      itemsFound: run.itemsFound,
      itemsCreated: run.itemsCreated,
      itemsUpdated: run.itemsUpdated,
      itemsRemoved: run.itemsRemoved,
      errorMessage: run.errorMessage,
      metadataJson: run.metadataJson,
    })),
    generatedAt: new Date().toISOString(),
  };
}