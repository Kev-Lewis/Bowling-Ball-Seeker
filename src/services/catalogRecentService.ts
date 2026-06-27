import { prisma } from "../db/prisma";
import { getCatalogStatus } from "../utils/catalogStatus";

function getSinceDate(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

function formatCatalogBall(ball: any) {
  return {
    ...ball,
    availableWeights: ball.availableWeightsJson
      ? JSON.parse(ball.availableWeightsJson)
      : [],
    availableWeightsJson: undefined,
    ...getCatalogStatus(ball),
  };
}

export async function getRecentlyAddedBalls(days = 14, limit = 50) {
  const since = getSinceDate(days);

  const balls = await prisma.ball.findMany({
    where: {
      isCurrent: true,
      firstSeenAt: {
        gte: since,
      },
    },
    orderBy: {
      firstSeenAt: "desc",
    },
    take: limit,
  });

  return {
    windowDays: days,
    count: balls.length,
    data: balls.map(formatCatalogBall),
    generatedAt: new Date().toISOString(),
  };
}

export async function getRecentlyDiscontinuedBalls(days = 14, limit = 50) {
  const since = getSinceDate(days);

  const balls = await prisma.ball.findMany({
    where: {
      isCurrent: false,
      removedFromLineupAt: {
        gte: since,
      },
    },
    orderBy: {
      removedFromLineupAt: "desc",
    },
    take: limit,
  });

  return {
    windowDays: days,
    count: balls.length,
    data: balls.map(formatCatalogBall),
    generatedAt: new Date().toISOString(),
  };
}

export async function getRecentCatalogUpdates(days = 14, limit = 50) {
  const [recentlyAdded, recentlyDiscontinued] = await Promise.all([
    getRecentlyAddedBalls(days, limit),
    getRecentlyDiscontinuedBalls(days, limit),
  ]);

  return {
    windowDays: days,
    recentlyAdded: {
      count: recentlyAdded.count,
      data: recentlyAdded.data,
    },
    recentlyDiscontinued: {
      count: recentlyDiscontinued.count,
      data: recentlyDiscontinued.data,
    },
    generatedAt: new Date().toISOString(),
  };
}