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