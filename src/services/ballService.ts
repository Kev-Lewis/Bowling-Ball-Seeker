import { prisma } from "../db/prisma";
import { getCatalogStatus } from "../utils/catalogStatus";

function formatBall(ball: any) {
  return {
    ...ball,
    availableWeights: ball.availableWeightsJson
      ? JSON.parse(ball.availableWeightsJson)
      : [],
    availableWeightsJson: undefined,
    ...getCatalogStatus(ball),
  };
}

export async function getAllBalls() {
  const balls = await prisma.ball.findMany({
    orderBy: [{ brand: "asc" }, { canonicalName: "asc" }],
  });

  return balls.map(formatBall);
}

export async function getCurrentBalls() {
  const balls = await prisma.ball.findMany({
    where: {
      isCurrent: true,
    },
    orderBy: [{ brand: "asc" }, { canonicalName: "asc" }],
  });

  return balls.map(formatBall);
}

export async function getBallById(id: string) {
  const ball = await prisma.ball.findUnique({
    where: {
      id,
    },
  });

  return ball ? formatBall(ball) : null;
}

export async function searchBalls(query: string) {
  const normalizedQuery = query.trim();

  const balls = await prisma.ball.findMany({
    where: {
      OR: [
        {
          canonicalName: {
            contains: normalizedQuery,
          },
        },
        {
          brand: {
            contains: normalizedQuery,
          },
        },
        {
          manufacturer: {
            contains: normalizedQuery,
          },
        },
      ],
    },
    orderBy: [{ brand: "asc" }, { canonicalName: "asc" }],
  });

  return balls.map(formatBall);
}

export async function getListingsForBall(ballId: string) {
  return prisma.retailerListing.findMany({
    where: {
      ballId,
    },
    orderBy: [{ currentPrice: "asc" }],
  });
}

export async function getBestVerifiedPrice(ballId: string) {
  const listing = await prisma.retailerListing.findFirst({
    where: {
      ballId,
      condition: "new",
      stockStatus: "in_stock",
      retailerType: "verified_retailer",
      matchConfidence: {
        gte: 95,
      },
    },
    orderBy: {
      currentPrice: "asc",
    },
  });

  return listing;
}