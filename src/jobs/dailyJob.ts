import { runDailyManufacturerSync } from "./manufacturerSyncJob";
import {
  runPriceAlertJob,
  type PriceAlertJobOptions,
} from "./priceAlertJob";
import {
  runMockRetailerScrapeJob,
  type RetailerScrapeJobOptions,
} from "./retailerScrapeJob";

export interface DailySystemJobOptions {
  runManufacturerSync?: boolean;
  runRetailerScrape?: boolean;
  runPriceAlerts?: boolean;
  retailerScrapeOptions?: RetailerScrapeJobOptions;
  priceAlertOptions?: PriceAlertJobOptions;
}

export async function runDailySystemJob(options: DailySystemJobOptions = {}) {
  const startedAt = new Date().toISOString();

  const runManufacturerSyncStep = options.runManufacturerSync ?? true;
  const runRetailerScrapeStep = options.runRetailerScrape ?? true;
  const runPriceAlertsStep = options.runPriceAlerts ?? true;

  const steps = [];
  let successfulStepCount = 0;
  let failedStepCount = 0;
  let skippedStepCount = 0;

  if (runManufacturerSyncStep) {
    try {
      const manufacturerSync = await runDailyManufacturerSync();

      const status =
        manufacturerSync.failedCount > 0 ? "failed" : "success";

      if (status === "success") {
        successfulStepCount += 1;
      } else {
        failedStepCount += 1;
      }

      steps.push({
        name: "manufacturer_sync",
        status,
        data: manufacturerSync,
      });
    } catch (error) {
      failedStepCount += 1;

      steps.push({
        name: "manufacturer_sync",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown manufacturer sync error",
      });
    }
  } else {
    skippedStepCount += 1;

    steps.push({
      name: "manufacturer_sync",
      status: "skipped",
    });
  }

  if (runRetailerScrapeStep) {
    try {
      const retailerScrape = await runMockRetailerScrapeJob({
        allowLikelyMatch:
          options.retailerScrapeOptions?.allowLikelyMatch ?? true,
        minConfidence: options.retailerScrapeOptions?.minConfidence ?? 35,
      });

      const status =
        retailerScrape.skippedNoMatchCount > 0 ||
        retailerScrape.skippedNeedsReviewCount > 0
          ? "partial_success"
          : "success";

      successfulStepCount += 1;

      steps.push({
        name: "retailer_scrape",
        status,
        data: retailerScrape,
      });
    } catch (error) {
      failedStepCount += 1;

      steps.push({
        name: "retailer_scrape",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown retailer scrape error",
      });
    }
  } else {
    skippedStepCount += 1;

    steps.push({
      name: "retailer_scrape",
      status: "skipped",
    });
  }

  if (runPriceAlertsStep) {
    try {
      const priceAlerts = await runPriceAlertJob({
        days: options.priceAlertOptions?.days ?? 7,
        limit: options.priceAlertOptions?.limit ?? 20,
        minPriceDrop: options.priceAlertOptions?.minPriceDrop ?? 5,
        minPercentDrop: options.priceAlertOptions?.minPercentDrop ?? 0,
        includeStockChanges:
          options.priceAlertOptions?.includeStockChanges ?? true,
        inStockOnly: options.priceAlertOptions?.inStockOnly ?? true,
        destinationType:
          options.priceAlertOptions?.destinationType ?? "discord",
        destinationId:
          options.priceAlertOptions?.destinationId ?? "daily-local",
      });

      successfulStepCount += 1;

      steps.push({
        name: "price_alerts",
        status: "success",
        data: priceAlerts,
      });
    } catch (error) {
      failedStepCount += 1;

      steps.push({
        name: "price_alerts",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown price alert job error",
      });
    }
  } else {
    skippedStepCount += 1;

    steps.push({
      name: "price_alerts",
      status: "skipped",
    });
  }

  return {
    jobName: "daily_system_job",
    startedAt,
    finishedAt: new Date().toISOString(),
    status: failedStepCount > 0 ? "failed" : "success",
    successfulStepCount,
    failedStepCount,
    skippedStepCount,
    steps,
  };
}