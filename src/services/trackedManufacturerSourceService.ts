import { createHash } from "crypto";
import { prisma } from "../db/prisma";

export interface TrackedManufacturerSourceFilters {
  manufacturerName?: string;
  brandName?: string;
  sourceKind?: string;
  parserKey?: string;
  enabled?: boolean;
}

export interface TrackedManufacturerSourceInput {
  name: string;
  manufacturerName: string;
  brandName?: string | null;
  sourceKind: string;
  parserKey: string;
  url: string;
  enabled?: boolean;
  maxPages?: number | null;
  maxProducts?: number | null;
  scrapeDelayMs?: number | null;
}

function cleanString(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequiredString(value: string | null | undefined, fieldName: string) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    throw new Error(`${fieldName} is required.`);
  }

  return cleaned;
}

function cleanNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

function buildTrackedManufacturerSourceId(
  manufacturerName: string,
  sourceKind: string,
  parserKey: string,
  url: string
) {
  const hash = createHash("sha1")
    .update(`${manufacturerName}|${sourceKind}|${parserKey}|${url}`)
    .digest("hex")
    .slice(0, 16);

  return `manufacturer-source-${hash}`;
}

export async function getTrackedManufacturerSources(
  filters: TrackedManufacturerSourceFilters = {}
) {
  const sources = await prisma.trackedManufacturerSource.findMany({
    where: {
      manufacturerName: filters.manufacturerName || undefined,
      brandName: filters.brandName || undefined,
      sourceKind: filters.sourceKind || undefined,
      parserKey: filters.parserKey || undefined,
      enabled: typeof filters.enabled === "boolean" ? filters.enabled : undefined,
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

  return {
    count: sources.length,
    filters: {
      manufacturerName: filters.manufacturerName ?? null,
      brandName: filters.brandName ?? null,
      sourceKind: filters.sourceKind ?? null,
      parserKey: filters.parserKey ?? null,
      enabled: filters.enabled ?? null,
    },
    data: sources,
    generatedAt: new Date().toISOString(),
  };
}

export async function upsertTrackedManufacturerSource(
  input: TrackedManufacturerSourceInput
) {
  const name = cleanRequiredString(input.name, "Source name");
  const manufacturerName = cleanRequiredString(
    input.manufacturerName,
    "Manufacturer name"
  );
  const sourceKind = cleanRequiredString(input.sourceKind, "Source kind");
  const parserKey = cleanRequiredString(input.parserKey, "Parser key");
  const url = cleanRequiredString(input.url, "URL");

  const existing = await prisma.trackedManufacturerSource.findUnique({
    where: {
      manufacturerName_url: {
        manufacturerName,
        url,
      },
    },
  });

  const id =
    existing?.id ??
    buildTrackedManufacturerSourceId(manufacturerName, sourceKind, parserKey, url);

  const data = {
    name,
    manufacturerName,
    brandName: cleanString(input.brandName),
    sourceKind,
    parserKey,
    url,
    enabled: input.enabled ?? true,
    maxPages: cleanNumber(input.maxPages),
    maxProducts: cleanNumber(input.maxProducts),
    scrapeDelayMs: cleanNumber(input.scrapeDelayMs),
  };

  const source = await prisma.trackedManufacturerSource.upsert({
    where: {
      id,
    },
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

export async function setTrackedManufacturerSourceEnabled(
  id: string,
  enabled: boolean
) {
  const source = await prisma.trackedManufacturerSource.update({
    where: {
      id,
    },
    data: {
      enabled,
    },
  });

  return {
    data: source,
    generatedAt: new Date().toISOString(),
  };
}
