import { recordPriceAlertPreview } from "../services/alertLogService";
import type { PriceAlertPreviewOptions } from "../services/priceAlertPreviewService";

export interface PriceAlertJobOptions extends PriceAlertPreviewOptions {
  destinationType?: string;
  destinationId?: string;
}

export async function runPriceAlertJob(options: PriceAlertJobOptions = {}) {
  const startedAt = new Date().toISOString();

  const destinationType = options.destinationType ?? "discord";
  const destinationId = options.destinationId ?? "local-test";

  const result = await recordPriceAlertPreview(
    {
      days: options.days ?? 7,
      limit: options.limit ?? 20,
      minPriceDrop: options.minPriceDrop ?? 5,
      minPercentDrop: options.minPercentDrop ?? 0,
      includeStockChanges: options.includeStockChanges ?? true,
      inStockOnly: options.inStockOnly ?? true,
    },
    destinationType,
    destinationId
  );

  return {
    jobName: "price_alert_job",
    startedAt,
    finishedAt: new Date().toISOString(),
    destination: result.destination,
    previewCount: result.previewCount,
    newAlertCount: result.newAlertCount,
    skippedAlertCount: result.skippedAlertCount,
    newAlerts: result.newAlerts,
    skippedAlerts: result.skippedAlerts,
  };
}