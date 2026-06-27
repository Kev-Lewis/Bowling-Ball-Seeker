import { Router } from "express";
import { runDailyManufacturerSync } from "../jobs/manufacturerSyncJob";
import { getLocalSchedulerStatus } from "../scheduler/localScheduler";
import { runPriceAlertJob } from "../jobs/priceAlertJob";
import { runDailySystemJob } from "../jobs/dailyJob";
import {
  runBowlingComProductScrapeJob,
  runMockRetailerScrapeJob,
} from "../jobs/retailerScrapeJob";

export const jobRoutes = Router();

function getNumberQuery(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function getBooleanQuery(value: unknown, fallback: boolean) {
  const parsed = value?.toString().toLowerCase();

  if (parsed === "true") {
    return true;
  }

  if (parsed === "false") {
    return false;
  }

  return fallback;
}

function getStringQuery(value: unknown, fallback: string) {
  const parsed = value?.toString().trim();

  return parsed || fallback;
}

function getStringListQuery(value: unknown) {
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => item?.toString().split(",") ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

jobRoutes.get("/daily-manufacturer-sync/run", async (_req, res) => {
  try {
    const result = await runDailyManufacturerSync();

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown daily manufacturer sync error";

    return res.status(500).json({
      error: "Failed to run daily manufacturer sync",
      details: message,
    });
  }
});

jobRoutes.get("/scheduler/status", (_req, res) => {
  return res.json({
    data: getLocalSchedulerStatus(),
  });
});

jobRoutes.get("/price-alerts/run", async (req, res) => {
  try {
    const days = getNumberQuery(req.query.days, 7);
    const limit = getNumberQuery(req.query.limit, 20);
    const minPriceDrop = getNumberQuery(req.query.minPriceDrop, 5);
    const minPercentDrop = getNumberQuery(req.query.minPercentDrop, 0);
    const includeStockChanges = getBooleanQuery(
      req.query.includeStockChanges,
      true
    );
    const inStockOnly = getBooleanQuery(req.query.inStockOnly, true);

    const destinationType = getStringQuery(
      req.query.destinationType,
      "discord"
    );
    const destinationId = getStringQuery(req.query.destinationId, "local-test");

    const result = await runPriceAlertJob({
      days,
      limit,
      minPriceDrop,
      minPercentDrop,
      includeStockChanges,
      inStockOnly,
      destinationType,
      destinationId,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown price alert job error";

    return res.status(500).json({
      error: "Failed to run price alert job",
      details: message,
    });
  }
});

jobRoutes.get("/daily/run", async (req, res) => {
  try {
    const days = getNumberQuery(req.query.days, 7);
    const limit = getNumberQuery(req.query.limit, 20);
    const minPriceDrop = getNumberQuery(req.query.minPriceDrop, 5);
    const minPercentDrop = getNumberQuery(req.query.minPercentDrop, 0);

    const includeStockChanges = getBooleanQuery(
      req.query.includeStockChanges,
      true
    );

    const inStockOnly = getBooleanQuery(req.query.inStockOnly, true);

    const runManufacturerSync = getBooleanQuery(
      req.query.runManufacturerSync,
      true
    );

    const runPriceAlerts = getBooleanQuery(req.query.runPriceAlerts, true);

    const destinationType = getStringQuery(
      req.query.destinationType,
      "discord"
    );

    const destinationId = getStringQuery(
      req.query.destinationId,
      "daily-local"
    );

    const runRetailerScrape = getBooleanQuery(
  req.query.runRetailerScrape,
  true
);

const allowLikelyMatch = getBooleanQuery(
  req.query.allowLikelyMatch,
  true
);

const runBowlingComProductScrape = getBooleanQuery(
  req.query.runBowlingComProductScrape,
  true
);

const bowlingComProductUrls = getStringListQuery(req.query.bowlingComUrl);

const minConfidence = getNumberQuery(req.query.minConfidence, 35);

    const result = await runDailySystemJob({
  runManufacturerSync,
  runRetailerScrape,
  runBowlingComProductScrape,
  runPriceAlerts,
  bowlingComProductUrls:
    bowlingComProductUrls.length > 0 ? bowlingComProductUrls : undefined,
  retailerScrapeOptions: {
    allowLikelyMatch,
    minConfidence,
  },
  priceAlertOptions: {
    days,
    limit,
    minPriceDrop,
    minPercentDrop,
    includeStockChanges,
    inStockOnly,
    destinationType,
    destinationId,
  },
});

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown daily job error";

    return res.status(500).json({
      error: "Failed to run daily system job",
      details: message,
    });
  }
});

jobRoutes.get("/mock-retailer-scrape/run", async (req, res) => {
  try {
    const allowLikelyMatch = getBooleanQuery(req.query.allowLikelyMatch, false);
    const minConfidence = getNumberQuery(req.query.minConfidence, 35);

    const result = await runMockRetailerScrapeJob({
      allowLikelyMatch,
      minConfidence,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown mock retailer scrape error";

    return res.status(500).json({
      error: "Failed to run mock retailer scrape job",
      details: message,
    });
  }
});

jobRoutes.get("/bowling-com-product-scrape/run", async (req, res) => {
  try {
    const rawUrl = req.query.url?.toString().trim();

    if (!rawUrl) {
      return res.status(400).json({
        error: "Missing required query parameter: url",
      });
    }

    const allowLikelyMatch = getBooleanQuery(req.query.allowLikelyMatch, true);
    const minConfidence = getNumberQuery(req.query.minConfidence, 35);

    const result = await runBowlingComProductScrapeJob([rawUrl], {
      allowLikelyMatch,
      minConfidence,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com product scrape job error";

    return res.status(500).json({
      error: "Failed to run Bowling.com product scrape job",
      details: message,
    });
  }
});