import { prisma } from "../db/prisma";

export interface CatalogBallAdminInput {
  id?: string;
  canonicalName: string;
  brand: string;
  manufacturer?: string;
  coverstockName?: string | null;
  coverstockType?: string;
  coreName?: string | null;
  coreType?: string;
  factoryFinish?: string | null;
  rg?: number | null;
  differential?: number | null;
  mbDifferential?: number | null;
  availableWeights?: number[];
  officialUrl?: string | null;
  imageUrl?: string | null;
  isCurrent?: boolean;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildCatalogBallId(brand: string, canonicalName: string) {
  return `${slugify(brand)}-${slugify(canonicalName)}`;
}

function cleanString(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequiredString(value: string | null | undefined, fieldName: string) {
  const cleaned = value?.trim();

  if (!cleaned) {
    throw new Error(`${fieldName} is required.`);
  }

  return cleaned;
}

function cleanNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

function normalizeWeights(weights?: number[]) {
  if (!weights || weights.length === 0) {
    return JSON.stringify([]);
  }

  return JSON.stringify(
    [...new Set(weights)]
      .filter((weight) => Number.isFinite(weight) && weight > 0)
      .sort((a, b) => a - b)
  );
}

export async function upsertCatalogBallFromAdmin(input: CatalogBallAdminInput) {
  const now = new Date();

  const canonicalName = cleanRequiredString(input.canonicalName, "Canonical name");
  const brand = cleanRequiredString(input.brand, "Brand");
  const manufacturer = cleanString(input.manufacturer) ?? brand;
  const coverstockType = cleanString(input.coverstockType) ?? "unknown";
  const coreType = cleanString(input.coreType) ?? "unknown";
  const id = cleanString(input.id) ?? buildCatalogBallId(brand, canonicalName);

  const existing = await prisma.ball.findUnique({
    where: { id },
  });

  const data = {
    canonicalName,
    brand,
    manufacturer,
    coverstockName: cleanString(input.coverstockName),
    coverstockType,
    coreName: cleanString(input.coreName),
    coreType,
    factoryFinish: cleanString(input.factoryFinish),
    rg: cleanNumber(input.rg),
    differential: cleanNumber(input.differential),
    mbDifferential: cleanNumber(input.mbDifferential),
    availableWeightsJson: normalizeWeights(input.availableWeights),
    officialUrl: cleanString(input.officialUrl),
    imageUrl: cleanString(input.imageUrl),
    isCurrent: input.isCurrent ?? true,
    lastSeenAt: now,
  };

  const ball = await prisma.ball.upsert({
    where: { id },
    create: {
      id,
      ...data,
      firstSeenAt: now,
    },
    update: data,
  });

  return {
    action: existing ? "updated" : "created",
    data: ball,
    generatedAt: new Date().toISOString(),
  };
}
