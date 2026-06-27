import { prisma } from "../db/prisma";
import { scrapeMotivManufacturerCatalog } from "../scrapers/manufacturers/motivScraper";
import {
  completeScrapeRun,
  failScrapeRun,
  startScrapeRun,
} from "../services/scrapeRunService";
import { syncManufacturerCatalog } from "../services/catalogSyncService";

export type ManufacturerSyncJobStatus = "success" | "failed";

export interface ManufacturerSyncJobResult {
  sourceName: string;
  status: ManufacturerSyncJobStatus;
  scrapeRunId: string;
  discoveredCount?: number;
  parsedCount?: number;
  failureCount?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsRemoved?: number;
  error?: string;
  details?: unknown;
}

export async function runMotivManufacturerSync(
  options: { sourceUrl?: string } = {}
): Promise<ManufacturerSyncJobResult> {
  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_catalog_live_sync",
    metadata: {
      mode: "job",
      purpose: "discover_parse_and_sync_current_catalog",
    },
  });

  try {
    const catalogResult = await scrapeMotivManufacturerCatalog(options.sourceUrl);

    if (catalogResult.parseFailures.length > 0) {
      const errorMessage = "One or more MOTIV ball pages failed to parse.";

      await failScrapeRun(scrapeRun.id, errorMessage, {
        mode: "job",
        sourceUrl: catalogResult.sourceUrl,
        discoveredCount: catalogResult.discoveredCount,
        parsedCount: catalogResult.parsedCount,
        failureCount: catalogResult.failureCount,
        parseFailures: catalogResult.parseFailures,
      });

      return {
        sourceName: "Motiv",
        status: "failed",
        scrapeRunId: scrapeRun.id,
        discoveredCount: catalogResult.discoveredCount,
        parsedCount: catalogResult.parsedCount,
        failureCount: catalogResult.failureCount,
        error: errorMessage,
        details: catalogResult.parseFailures,
      };
    }

    const syncResult = await syncManufacturerCatalog(
      "Motiv",
      catalogResult.parsedBalls
    );

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: catalogResult.discoveredCount,
      itemsCreated: syncResult.created.length,
      itemsUpdated: syncResult.updated.length + syncResult.relisted.length,
      itemsRemoved: syncResult.removed.length,
      metadata: {
        mode: "job",
        sourceUrl: catalogResult.sourceUrl,
        discoveredCount: catalogResult.discoveredCount,
        parsedCount: catalogResult.parsedCount,
        syncResult,
      },
    });

    return {
      sourceName: "Motiv",
      status: "success",
      scrapeRunId: scrapeRun.id,
      discoveredCount: catalogResult.discoveredCount,
      parsedCount: catalogResult.parsedCount,
      failureCount: catalogResult.failureCount,
      itemsCreated: syncResult.created.length,
      itemsUpdated: syncResult.updated.length + syncResult.relisted.length,
      itemsRemoved: syncResult.removed.length,
      details: syncResult,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown MOTIV sync error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "job",
      purpose: "discover_parse_and_sync_current_catalog",
    });

    return {
      sourceName: "Motiv",
      status: "failed",
      scrapeRunId: scrapeRun.id,
      error: message,
    };
  }
}

export async function runTrackedManufacturerSourceSync(source: {
  id: string;
  name: string;
  manufacturerName: string;
  parserKey: string;
  url: string;
}): Promise<ManufacturerSyncJobResult> {
  if (source.parserKey === "motiv") {
    return runMotivManufacturerSync({
      sourceUrl: source.url,
    });
  }

  return {
    sourceName: source.manufacturerName,
    status: "failed",
    scrapeRunId: "unsupported-parser",
    error: `No runner is wired for parserKey: ${source.parserKey}`,
    details: {
      sourceId: source.id,
      sourceName: source.name,
      parserKey: source.parserKey,
    },
  };
}

export async function runEnabledTrackedManufacturerSources() {
  const sources = await prisma.trackedManufacturerSource.findMany({
    where: {
      enabled: true,
    },
    orderBy: [
      {
        manufacturerName: "asc",
      },
      {
        brandName: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  const results = [];

  for (const source of sources) {
    const result = await runTrackedManufacturerSourceSync(source);

    results.push({
      source,
      result,
    });
  }

  return results;
}

export async function runDailyManufacturerSync() {
  const startedAt = new Date().toISOString();

  const results = await Promise.all([runMotivManufacturerSync()]);

  const successfulCount = results.filter((result) => {
    return result.status === "success";
  }).length;

  const failedCount = results.filter((result) => {
    return result.status === "failed";
  }).length;

  return {
    jobName: "daily_manufacturer_sync",
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceCount: results.length,
    successfulCount,
    failedCount,
    results,
  };
}