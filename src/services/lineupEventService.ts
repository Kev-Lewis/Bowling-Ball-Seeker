import { prisma } from "../db/prisma";

export async function getAllLineupEvents(limit = 50) {
  return prisma.lineupEvent.findMany({
    take: limit,
    orderBy: {
      detectedAt: "desc",
    },
    include: {
      ball: true,
    },
  });
}

export async function getLineupEventsForBall(ballId: string) {
  return prisma.lineupEvent.findMany({
    where: {
      ballId,
    },
    orderBy: {
      detectedAt: "desc",
    },
    include: {
      ball: true,
    },
  });
}

export async function getLineupEventsByType(eventType: string, limit = 50) {
  return prisma.lineupEvent.findMany({
    where: {
      eventType,
    },
    take: limit,
    orderBy: {
      detectedAt: "desc",
    },
    include: {
      ball: true,
    },
  });
}