import { Router } from "express";
import { runDailySystemJob } from "../jobs/dailyJob";
import { runDailyManufacturerSync } from "../jobs/manufacturerSyncJob";
import { runPriceAlertJob } from "../jobs/priceAlertJob";
import {
  runBowlingComCategoryScrapeJob,
  runBowlingComProductScrapeJob,
  runMockRetailerScrapeJob,
} from "../jobs/retailerScrapeJob";
import { getLocalSchedulerStatus } from "../scheduler/localScheduler";

export const jobRoutes = Router();

function getNumberQuery(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function getBooleanQuery(value: unknown, fallback: boolean) {
  const parsed = value?.toString().trim().toLowerCase();

  if (parsed === "true" || parsed === "1" || parsed === "yes") {
    return true;
  }

  if (parsed === "false" || parsed === "0" || parsed === "no") {
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

    const runRetailerScrape = getBooleanQuery(
      req.query.runRetailerScrape,
      true
    );

    const runBowlingComProductScrape = getBooleanQuery(
      req.query.runBowlingComProductScrape,
      true
    );

    const runBowlingComCategoryScrape = getBooleanQuery(
      req.query.runBowlingComCategoryScrape,
      true
    );

    const runPriceAlerts = getBooleanQuery(req.query.runPriceAlerts, true);

    const allowLikelyMatch = getBooleanQuery(
      req.query.allowLikelyMatch,
      true
    );

    const minConfidence = getNumberQuery(req.query.minConfidence, 35);
    const scrapeDelayMs = getNumberQuery(req.query.scrapeDelayMs, 750);

    const bowlingComProductUrls = getStringListQuery(req.query.bowlingComUrl);

    const bowlingComCategoryUrls = getStringListQuery(
      req.query.bowlingComCategoryUrl
    );

    const bowlingComCategoryMaxPages = getNumberQuery(
      req.query.bowlingComCategoryMaxPages,
      1
    );

    const bowlingComCategoryMaxProducts = getNumberQuery(
      req.query.bowlingComCategoryMaxProducts,
      10
    );

    const destinationType = getStringQuery(
      req.query.destinationType,
      "discord"
    );

    const destinationId = getStringQuery(
      req.query.destinationId,
      "daily-local"
    );

    const result = await runDailySystemJob({
      runManufacturerSync,
      runRetailerScrape,
      runBowlingComProductScrape,
      runBowlingComCategoryScrape,
      runPriceAlerts,
      bowlingComProductUrls:
        bowlingComProductUrls.length > 0 ? bowlingComProductUrls : undefined,
      bowlingComCategoryUrls:
        bowlingComCategoryUrls.length > 0 ? bowlingComCategoryUrls : undefined,
      retailerScrapeOptions: {
        allowLikelyMatch,
        minConfidence,
        scrapeDelayMs,
      },
      bowlingComCategoryScrapeOptions: {
        allowLikelyMatch,
        minConfidence,
        maxPages: bowlingComCategoryMaxPages,
        maxProducts: bowlingComCategoryMaxProducts,
        scrapeDelayMs,
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
      error instanceof Error
        ? error.message
        : "Unknown mock retailer scrape error";

    return res.status(500).json({
      error: "Failed to run mock retailer scrape job",
      details: message,
    });
  }
});

jobRoutes.get("/bowling-com-product-scrape/run", async (req, res) => {
  try {
    const urls = getStringListQuery(req.query.url);

    if (urls.length === 0) {
      return res.status(400).json({
        error: "Missing required query parameter: url",
      });
    }

    const allowLikelyMatch = getBooleanQuery(req.query.allowLikelyMatch, true);
    const minConfidence = getNumberQuery(req.query.minConfidence, 35);
    const scrapeDelayMs = getNumberQuery(req.query.scrapeDelayMs, 750);

    const result = await runBowlingComProductScrapeJob(urls, {
      allowLikelyMatch,
      minConfidence,
      scrapeDelayMs,
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

jobRoutes.get("/bowling-com-category-scrape/run", async (req, res) => {
  try {
    const rawUrl = req.query.url?.toString().trim();

    if (!rawUrl) {
      return res.status(400).json({
        error: "Missing required query parameter: url",
      });
    }

    const allowLikelyMatch = getBooleanQuery(req.query.allowLikelyMatch, true);
    const minConfidence = getNumberQuery(req.query.minConfidence, 35);
    const maxPages = getNumberQuery(req.query.maxPages, 1);
    const maxProducts = getNumberQuery(req.query.maxProducts, 10);
    const scrapeDelayMs = getNumberQuery(req.query.scrapeDelayMs, 750);

    const result = await runBowlingComCategoryScrapeJob(rawUrl, {
      allowLikelyMatch,
      minConfidence,
      maxPages,
      maxProducts,
      scrapeDelayMs,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com category scrape job error";

    return res.status(500).json({
      error: "Failed to run Bowling.com category scrape job",
      details: message,
    });
  }
});