import type { Prisma } from "@prisma/client";
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

export interface CatalogBallAdminListOptions {
  limit?: number;
  search?: string;
  brand?: string;
  manufacturer?: string;
  isCurrent?: boolean;
}

function getSafeLimit(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return 50;
  }

  return Math.min(value, 200);
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

function parseWeights(weightsJson: string | null) {
  if (!weightsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(weightsJson);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((weight) => Number.isFinite(Number(weight)));
  } catch {
    return [];
  }
}

function serializeBall(ball: any) {
  return {
    ...ball,
    availableWeights: parseWeights(ball.availableWeightsJson ?? null),
  };
}

export async function getCatalogBallsForAdmin(
  options: CatalogBallAdminListOptions = {}
) {
  const limit = getSafeLimit(options.limit);
  const where: Prisma.BallWhereInput = {};

  if (options.brand) {
    where.brand = {
      contains: options.brand,
    };
  }

  if (options.manufacturer) {
    where.manufacturer = {
      contains: options.manufacturer,
    };
  }

  if (typeof options.isCurrent === "boolean") {
    where.isCurrent = options.isCurrent;
  }

  if (options.search) {
    where.OR = [
      {
        id: {
          contains: options.search,
        },
      },
      {
        canonicalName: {
          contains: options.search,
        },
      },
      {
        brand: {
          contains: options.search,
        },
      },
      {
        manufacturer: {
          contains: options.search,
        },
      },
      {
        coverstockName: {
          contains: options.search,
        },
      },
      {
        coreName: {
          contains: options.search,
        },
      },
    ];
  }

  const balls = await prisma.ball.findMany({
    where,
    orderBy: [
      {
        brand: "asc",
      },
      {
        canonicalName: "asc",
      },
    ],
    take: limit,
    include: {
      _count: {
        select: {
          listings: true,
          lineupEvents: true,
        },
      },
    },
  });

  return {
    count: balls.length,
    filters: {
      limit,
      search: options.search ?? null,
      brand: options.brand ?? null,
      manufacturer: options.manufacturer ?? null,
      isCurrent: options.isCurrent ?? null,
    },
    data: balls.map(serializeBall),
    generatedAt: new Date().toISOString(),
  };
}

export async function getCatalogBallAdminDetail(ballId: string) {
  const ball = await prisma.ball.findUnique({
    where: {
      id: ballId,
    },
    include: {
      listings: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 20,
      },
      lineupEvents: {
        take: 20,
      },
      _count: {
        select: {
          listings: true,
          lineupEvents: true,
        },
      },
    },
  });

  if (!ball) {
    return null;
  }

  return {
    data: serializeBall(ball),
    generatedAt: new Date().toISOString(),
  };
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
    where: {
      id,
    },
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
    where: {
      id,
    },
    create: {
      id,
      ...data,
      firstSeenAt: now,
    },
    update: data,
  });

  return {
    action: existing ? "updated" : "created",
    data: serializeBall(ball),
    generatedAt: new Date().toISOString(),
  };
}
