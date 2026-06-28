import { createHash } from "crypto";
import { prisma } from "../db/prisma";
import {
  runBowlingComCategoryScrapeJob,
  runBowlingComProductScrapeJob,
} from "../jobs/retailerScrapeJob";

export interface TrackedRetailerSourceInput {
  name: string;
  retailerName: string;
  sourceKind: "category" | "product";
  url: string;
  enabled?: boolean;
  maxPages?: number | null;
  maxProducts?: number | null;
  scrapeDelayMs?: number | null;
  allowLikelyMatch?: boolean;
}

export interface TrackedRetailerSourceFilters {
  enabled?: boolean;
  retailerName?: string;
  sourceKind?: string;
}

function normalizeUrl(url: string) {
  return url.trim();
}

function getTrackedSourceId(retailerName: string, url: string) {
  const hash = createHash("sha256")
    .update(`${retailerName.trim().toLowerCase()}|${normalizeUrl(url)}`)
    .digest("hex")
    .slice(0, 16);

  return `tracked-source-${hash}`;
}

function safeNumber(value: number | null | undefined, fallback: number | null) {
  if (value === null || value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function safeBoolean(value: boolean | undefined, fallback: boolean) {
  return value === undefined ? fallback : value;
}

function assertSupportedSource(input: {
  retailerName: string;
  sourceKind: string;
  url: string;
}) {
  const retailerName = input.retailerName.trim().toLowerCase();

  if (retailerName !== "bowling.com") {
    throw new Error("Tracked source runner currently supports bowling.com only.");
  }

  if (input.sourceKind !== "category" && input.sourceKind !== "product") {
    throw new Error("sourceKind must be category or product.");
  }

  const parsedUrl = new URL(input.url);

  if (
    parsedUrl.hostname !== "bowling.com" &&
    parsedUrl.hostname !== "www.bowling.com"
  ) {
    throw new Error("Tracked bowling.com sources must use a bowling.com URL.");
  }
}

export async function getTrackedRetailerSources(
  filters: TrackedRetailerSourceFilters = {}
) {
  const sources = await prisma.trackedRetailerSource.findMany({
    where: {
      ...(filters.enabled === undefined ? {} : { enabled: filters.enabled }),
      ...(filters.retailerName ? { retailerName: filters.retailerName } : {}),
      ...(filters.sourceKind ? { sourceKind: filters.sourceKind } : {}),
    },
    orderBy: [{ retailerName: "asc" }, { name: "asc" }],
  });

  return {
    count: sources.length,
    filters: {
      enabled: filters.enabled ?? null,
      retailerName: filters.retailerName ?? null,
      sourceKind: filters.sourceKind ?? null,
    },
    data: sources,
    generatedAt: new Date().toISOString(),
  };
}

export async function upsertTrackedRetailerSource(
  input: TrackedRetailerSourceInput
) {
  const name = input.name.trim();
  const retailerName = input.retailerName.trim();
  const sourceKind = input.sourceKind.trim().toLowerCase();
  const url = normalizeUrl(input.url);

  if (!name) throw new Error("Tracked source name is required.");
  if (!retailerName) throw new Error("Retailer name is required.");
  if (!url) throw new Error("Tracked source URL is required.");

  assertSupportedSource({ retailerName, sourceKind, url });

  const id = getTrackedSourceId(retailerName, url);

  const data = {
    name,
    retailerName,
    sourceKind,
    url,
    enabled: safeBoolean(input.enabled, true),
    maxPages: safeNumber(input.maxPages, sourceKind === "category" ? 1 : null),
    maxProducts: safeNumber(
      input.maxProducts,
      sourceKind === "category" ? 5 : null
    ),
    scrapeDelayMs: safeNumber(input.scrapeDelayMs, 750),
    allowLikelyMatch: safeBoolean(input.allowLikelyMatch, true),
  };

  const existing = await prisma.trackedRetailerSource.findUnique({
    where: { id },
  });

  const source = await prisma.trackedRetailerSource.upsert({
    where: { id },
    create: {
      id,
      ...data,
    },
    update: data,
  });

  return {
    action: existing ? "updated" : "created",
    data: source,
    generatedAt: new Date().toISOString(),
  };
}

export async function setTrackedRetailerSourceEnabled(
  id: string,
  enabled: boolean
) {
  const source = await prisma.trackedRetailerSource.update({
    where: { id },
    data: { enabled },
  });

  return {
    data: source,
    generatedAt: new Date().toISOString(),
  };
}

export async function seedDefaultTrackedRetailerSources() {
  const defaults: TrackedRetailerSourceInput[] = [
    {
      name: "Bowling.com Motiv Category",
      retailerName: "bowling.com",
      sourceKind: "category",
      url: "https://www.bowling.com/shopping/motiv/bowling-balls/all",
      enabled: true,
      maxPages: 1,
      maxProducts: 5,
      scrapeDelayMs: 750,
      allowLikelyMatch: true,
    },
    {
      name: "Bowling.com All Bowling Balls",
      retailerName: "bowling.com",
      sourceKind: "category",
      url: "https://www.bowling.com/shopping/all/bowling-balls/all",
      enabled: false,
      maxPages: 1,
      maxProducts: 5,
      scrapeDelayMs: 750,
      allowLikelyMatch: true,
    },
  ];

  const results = [];

  for (const source of defaults) {
    results.push(await upsertTrackedRetailerSource(source));
  }

  return {
    count: results.length,
    data: results,
    generatedAt: new Date().toISOString(),
  };
}

export async function runTrackedRetailerSource(id: string) {
  const source = await prisma.trackedRetailerSource.findUnique({
    where: { id },
  });

  if (!source) {
    throw new Error(`Tracked retailer source not found: ${id}`);
  }

  if (!source.enabled) {
    throw new Error(`Tracked retailer source is disabled: ${source.name}`);
  }

  assertSupportedSource({
    retailerName: source.retailerName,
    sourceKind: source.sourceKind,
    url: source.url,
  });

  if (source.sourceKind === "category") {
    const result = await runBowlingComCategoryScrapeJob(source.url, {
      maxPages: source.maxPages ?? 1,
      maxProducts: source.maxProducts ?? 5,
      scrapeDelayMs: source.scrapeDelayMs ?? 750,
      allowLikelyMatch: source.allowLikelyMatch,
    });

    return {
      source,
      result,
      generatedAt: new Date().toISOString(),
    };
  }

  const result = await runBowlingComProductScrapeJob([source.url], {
    scrapeDelayMs: source.scrapeDelayMs ?? 750,
    allowLikelyMatch: source.allowLikelyMatch,
  });

  return {
    source,
    result,
    generatedAt: new Date().toISOString(),
  };
}

export async function runEnabledTrackedRetailerSources() {
  const sources = await prisma.trackedRetailerSource.findMany({
    where: { enabled: true },
    orderBy: [{ retailerName: "asc" }, { name: "asc" }],
  });

  const results = [];

  for (const source of sources) {
    try {
      const data = await runTrackedRetailerSource(source.id);
      results.push({
        source,
        result: data.result,
        status: "success",
        error: null,
      });
    } catch (error) {
      results.push({
        source,
        result: null,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successfulCount = results.filter((item) => item.status === "success").length;
  const failedCount = results.filter((item) => item.status === "failed").length;

  return {
    sourceCount: sources.length,
    successfulCount,
    failedCount,
    results,
    generatedAt: new Date().toISOString(),
  };
}

export async function deleteTrackedRetailerSource(id: string) {
  const source = await prisma.trackedRetailerSource.findUnique({
    where: { id },
  });

  if (!source) {
    throw new Error(`Tracked retailer source not found: ${id}`);
  }

  if (source.enabled) {
    throw new Error("Disable the retailer source before deleting it.");
  }

  const deleted = await prisma.trackedRetailerSource.delete({
    where: { id },
  });

  return {
    data: deleted,
    generatedAt: new Date().toISOString(),
  };
}
