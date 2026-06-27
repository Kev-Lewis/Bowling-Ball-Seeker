import { randomUUID } from "crypto";
import { prisma } from "../db/prisma";
import {
  getPriceAlertPreview,
  type PriceAlertPreviewOptions,
} from "./priceAlertPreviewService";

type PriceAlertPreviewResult = Awaited<ReturnType<typeof getPriceAlertPreview>>;
type PriceAlertPreviewItem = PriceAlertPreviewResult["data"][number];

function buildDestinationKey(destinationType: string, destinationId?: string) {
  return `${destinationType}:${destinationId || "default"}`;
}

export async function recordPriceAlertPreview(
  options: PriceAlertPreviewOptions = {},
  destinationType = "discord",
  destinationId = "local-test"
) {
  const destinationKey = buildDestinationKey(destinationType, destinationId);
  const preview = await getPriceAlertPreview(options);

  const newAlerts: PriceAlertPreviewItem[] = [];
  const skippedAlerts: PriceAlertPreviewItem[] = [];
  const recordedLogs = [];

  for (const alert of preview.data) {
    const existingLog = await prisma.alertLog.findFirst({
      where: {
        dedupeKey: alert.dedupeKey,
        destinationKey,
      },
    });

    if (existingLog) {
      skippedAlerts.push(alert);
      continue;
    }

    const log = await prisma.alertLog.create({
      data: {
        id: randomUUID(),
        dedupeKey: alert.dedupeKey,
        destinationType,
        destinationId,
        destinationKey,
        alertType: alert.alertType,
        ballId: alert.ball.id,
        retailerListingId: alert.listing.id,
        message: alert.message,
        payloadJson: JSON.stringify(alert),
        sentAt: new Date(),
      },
    });

    recordedLogs.push(log);
    newAlerts.push(alert);
  }

  return {
    destination: {
      destinationType,
      destinationId,
      destinationKey,
    },
    previewCount: preview.count,
    newAlertCount: newAlerts.length,
    skippedAlertCount: skippedAlerts.length,
    newAlerts,
    skippedAlerts,
    recordedLogs,
    generatedAt: new Date().toISOString(),
  };
}

export async function getRecentAlertLogs(limit = 50) {
  const logs = await prisma.alertLog.findMany({
    orderBy: {
      sentAt: "desc",
    },
    take: limit,
  });

  return {
    count: logs.length,
    data: logs,
    generatedAt: new Date().toISOString(),
  };
}