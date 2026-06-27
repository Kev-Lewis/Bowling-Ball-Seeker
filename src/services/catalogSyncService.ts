import { randomUUID } from "crypto";
import { prisma } from "../db/prisma";
import type {
  CatalogSyncResult,
  ManufacturerBallInput,
} from "../types/catalog";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildBallId(brand: string, canonicalName: string) {
  return `${slugify(brand)}-${slugify(canonicalName)}`;
}

function normalizeWeights(weights?: number[]) {
  if (!weights || weights.length === 0) {
    return JSON.stringify([]);
  }

  return JSON.stringify([...weights].sort((a, b) => a - b));
}

function normalizeIncomingBall(ball: ManufacturerBallInput) {
  return {
    id: ball.id ?? buildBallId(ball.brand, ball.canonicalName),
    canonicalName: ball.canonicalName.trim(),
    brand: ball.brand.trim(),
    manufacturer: ball.manufacturer.trim(),
    coverstockName: ball.coverstockName ?? null,
    coverstockType: ball.coverstockType,
    coreName: ball.coreName ?? null,
    coreType: ball.coreType,
    factoryFinish: ball.factoryFinish ?? null,
    rg: ball.rg ?? null,
    differential: ball.differential ?? null,
    mbDifferential: ball.mbDifferential ?? null,
    availableWeightsJson: normalizeWeights(ball.availableWeights),
    officialUrl: ball.officialUrl ?? null,
    imageUrl: ball.imageUrl ?? null,
  };
}

function getChangedFields(existing: any, incoming: any) {
  const fieldsToCompare = [
    "canonicalName",
    "brand",
    "manufacturer",
    "coverstockName",
    "coverstockType",
    "coreName",
    "coreType",
    "factoryFinish",
    "rg",
    "differential",
    "mbDifferential",
    "availableWeightsJson",
    "officialUrl",
    "imageUrl",
  ];

  return fieldsToCompare.filter((field) => {
    return existing[field] !== incoming[field];
  });
}

export async function syncManufacturerCatalog(
  sourceName: string,
  incomingBalls: ManufacturerBallInput[]
): Promise<CatalogSyncResult> {
  const now = new Date();

  const normalizedIncomingBalls = incomingBalls.map(normalizeIncomingBall);
  const incomingIds = new Set(normalizedIncomingBalls.map((ball) => ball.id));

  const result: CatalogSyncResult = {
    sourceName,
    checkedAt: now.toISOString(),
    receivedCount: incomingBalls.length,
    created: [],
    updated: [],
    unchanged: [],
    relisted: [],
    removed: [],
    specChanged: [],
  };

  const existingBalls = await prisma.ball.findMany({
    where: {
      brand: sourceName,
    },
  });

  const existingById = new Map(existingBalls.map((ball) => [ball.id, ball]));

  await prisma.$transaction(async (tx) => {
    for (const incoming of normalizedIncomingBalls) {
      const existing = existingById.get(incoming.id);

      if (!existing) {
        await tx.ball.create({
          data: {
            ...incoming,
            isCurrent: true,
            firstSeenAt: now,
            lastSeenAt: now,
            removedFromLineupAt: null,
          },
        });

        await tx.lineupEvent.create({
          data: {
            id: randomUUID(),
            ballId: incoming.id,
            eventType: "new_ball_detected",
            sourceName,
            sourceUrl: incoming.officialUrl,
            detectedAt: now,
            notes: "New ball detected from manufacturer catalog sync.",
          },
        });

        result.created.push(incoming.id);
        continue;
      }

      const changedFields = getChangedFields(existing, incoming);

      if (!existing.isCurrent) {
        await tx.ball.update({
          where: {
            id: incoming.id,
          },
          data: {
            ...incoming,
            isCurrent: true,
            lastSeenAt: now,
            removedFromLineupAt: null,
          },
        });

        await tx.lineupEvent.create({
          data: {
            id: randomUUID(),
            ballId: incoming.id,
            eventType: "ball_relisted",
            sourceName,
            sourceUrl: incoming.officialUrl,
            detectedAt: now,
            notes: "Ball was previously removed and has appeared again in the manufacturer catalog.",
          },
        });

        result.relisted.push(incoming.id);
        continue;
      }

      if (changedFields.length > 0) {
        await tx.ball.update({
          where: {
            id: incoming.id,
          },
          data: {
            ...incoming,
            lastSeenAt: now,
          },
        });

        await tx.lineupEvent.create({
          data: {
            id: randomUUID(),
            ballId: incoming.id,
            eventType: "spec_changed",
            sourceName,
            sourceUrl: incoming.officialUrl,
            detectedAt: now,
            notes: `Changed fields: ${changedFields.join(", ")}`,
          },
        });

        result.updated.push(incoming.id);
        result.specChanged.push(incoming.id);
        continue;
      }

      await tx.ball.update({
        where: {
          id: incoming.id,
        },
        data: {
          lastSeenAt: now,
        },
      });

      result.unchanged.push(incoming.id);
    }

    const removedBalls = existingBalls.filter((ball) => {
      return ball.isCurrent && !incomingIds.has(ball.id);
    });

    for (const removedBall of removedBalls) {
      await tx.ball.update({
        where: {
          id: removedBall.id,
        },
        data: {
          isCurrent: false,
          lastSeenAt: now,
          removedFromLineupAt: now,
        },
      });

      await tx.lineupEvent.create({
        data: {
          id: randomUUID(),
          ballId: removedBall.id,
          eventType: "ball_removed_from_lineup",
          sourceName,
          sourceUrl: removedBall.officialUrl,
          detectedAt: now,
          notes: "Ball was not found in the latest manufacturer catalog sync.",
        },
      });

      result.removed.push(removedBall.id);
    }
  });

  return result;
}