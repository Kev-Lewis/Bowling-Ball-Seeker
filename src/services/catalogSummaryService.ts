import { prisma } from "../db/prisma";
import { getCatalogStatus } from "../utils/catalogStatus";

function incrementCount(map: Record<string, number>, key: string | null | undefined) {
  const safeKey = key && key.trim().length > 0 ? key : "unknown";
  map[safeKey] = (map[safeKey] ?? 0) + 1;
}

export async function getCatalogSummary() {
  const balls = await prisma.ball.findMany({
    orderBy: [{ brand: "asc" }, { canonicalName: "asc" }],
  });

  const byBrand: Record<string, number> = {};
  const byManufacturer: Record<string, number> = {};
  const byCoverstockType: Record<string, number> = {};
  const byCoreType: Record<string, number> = {};
  const byCatalogStatus: Record<string, number> = {};

  let currentBalls = 0;
  let inactiveBalls = 0;
  let newBalls = 0;
  let discontinuedBalls = 0;
  let archivedBalls = 0;

  for (const ball of balls) {
    const catalogStatus = getCatalogStatus(ball);

    incrementCount(byBrand, ball.brand);
    incrementCount(byManufacturer, ball.manufacturer);
    incrementCount(byCoverstockType, ball.coverstockType);
    incrementCount(byCoreType, ball.coreType);
    incrementCount(byCatalogStatus, catalogStatus.catalogStatus);

    if (ball.isCurrent) {
      currentBalls += 1;
    } else {
      inactiveBalls += 1;
    }

    if (catalogStatus.catalogStatus === "new") {
      newBalls += 1;
    }

    if (catalogStatus.catalogStatus === "discontinued") {
      discontinuedBalls += 1;
    }

    if (catalogStatus.catalogStatus === "archived") {
      archivedBalls += 1;
    }
  }

  return {
    totalBalls: balls.length,
    currentBalls,
    inactiveBalls,
    newBalls,
    discontinuedBalls,
    archivedBalls,
    byBrand,
    byManufacturer,
    byCoverstockType,
    byCoreType,
    byCatalogStatus,
    generatedAt: new Date().toISOString(),
  };
}