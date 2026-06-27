import { Router } from "express";
import {
  getRetailerListingsForBall,
  StockStatus,
  upsertRetailerListingWithSnapshot,
} from "../services/retailerListingService";
import type {
  ListingCondition,
  MatchStatus,
  RetailerType,
} from "../types/ball";
import { matchRetailerListingTitle } from "../services/listingMatchService";
import { getBallPriceSummary } from "../services/ballPriceSummaryService";
import { inspectRetailerPage } from "../scrapers/retailers/retailerInspector";
import {
  scrapeBowlingComCategoryPage,
  scrapeBowlingComCategoryPages,
  scrapeBowlingComProductPage,
} from "../scrapers/retailers/bowlingComScraper";
import { getRecentSkippedMatchReviews } from "../services/retailerMatchReviewService";
import { resolveRetailerListingMatch } from "../services/manualRetailerMatchService";
import { getRetailerMatchCandidates } from "../services/retailerMatchCandidateService";

export const retailerRoutes = Router();

const retailerTypes: RetailerType[] = ["verified_retailer", "marketplace"];
const listingConditions: ListingCondition[] = ["new", "used", "drilled", "unknown"];
const matchStatuses: MatchStatus[] = [
  "auto_matched",
  "likely_match",
  "manual_review",
  "rejected",
];
const stockStatuses: StockStatus[] = ["in_stock", "out_of_stock", "unknown"];

function getRequiredString(value: unknown, fieldName: string) {
  const parsed = value?.toString().trim();

  if (!parsed) {
    throw new Error(`Missing required field: ${fieldName}`);
  }

  return parsed;
}

function getNumber(value: unknown, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number field: ${fieldName}`);
  }

  return parsed;
}

function getAllowedValue<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: T[],
  fallback?: T
) {
  const parsed = value?.toString() as T | undefined;

  if (!parsed && fallback) {
    return fallback;
  }

  if (!parsed || !allowedValues.includes(parsed)) {
    throw new Error(
      `Invalid ${fieldName}. Allowed values: ${allowedValues.join(", ")}`
    );
  }

  return parsed;
}

function getBooleanQuery(value: unknown, fallback = false) {
  const parsed = value?.toString().toLowerCase();

  if (parsed === "true") {
    return true;
  }

  if (parsed === "false") {
    return false;
  }

  return fallback;
}

retailerRoutes.get("/inspect-page", async (req, res) => {
  try {
    const url = getRequiredString(req.query.url, "url");

    const result = await inspectRetailerPage(url);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown retailer inspection error";

    return res.status(400).json({
      error: "Failed to inspect retailer page",
      details: message,
    });
  }
});

retailerRoutes.get("/bowling-com/parse-product", async (req, res) => {
  try {
    const url = getRequiredString(req.query.url, "url");

    const result = await scrapeBowlingComProductPage(url);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com product parse error";

    return res.status(400).json({
      error: "Failed to parse Bowling.com product page",
      details: message,
    });
  }
});

retailerRoutes.get("/bowling-com/parse-category", async (req, res) => {
  try {
    const url = getRequiredString(req.query.url, "url");

    const result = await scrapeBowlingComCategoryPage(url);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com category parse error";

    return res.status(400).json({
      error: "Failed to parse Bowling.com category page",
      details: message,
    });
  }
});

retailerRoutes.get("/bowling-com/parse-category-pages", async (req, res) => {
  try {
    const url = getRequiredString(req.query.url, "url");
    const maxPages = Number(req.query.maxPages ?? 50);

    const result = await scrapeBowlingComCategoryPages(url, {
      maxPages: Number.isFinite(maxPages) && maxPages > 0 ? maxPages : 50,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com category pages parse error";

    return res.status(400).json({
      error: "Failed to parse Bowling.com category pages",
      details: message,
    });
  }
});

retailerRoutes.get("/match-listing", async (req, res) => {
  try {
    const listingTitle = getRequiredString(req.query.listingTitle, "listingTitle");

    const limit = req.query.limit ? getNumber(req.query.limit, "limit") : 10;
    const minConfidence = req.query.minConfidence
      ? getNumber(req.query.minConfidence, "minConfidence")
      : 35;

    const includeRejected = getBooleanQuery(req.query.includeRejected, false);
    const currentOnly = getBooleanQuery(req.query.currentOnly, true);

    const result = await matchRetailerListingTitle(listingTitle, {
      limit,
      minConfidence,
      includeRejected,
      currentOnly,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown listing match error";

    return res.status(400).json({
      error: "Failed to match retailer listing",
      details: message,
    });
  }
});

retailerRoutes.get("/manual-listing/upsert-with-match", async (req, res) => {
  try {
    const retailerName = getRequiredString(req.query.retailerName, "retailerName");
    const listingTitle = getRequiredString(req.query.listingTitle, "listingTitle");
    const listingUrl = getRequiredString(req.query.listingUrl, "listingUrl");
    const currentPrice = getNumber(req.query.currentPrice, "currentPrice");

    const allowLikelyMatch = getBooleanQuery(req.query.allowLikelyMatch, false);

    const retailerType = getAllowedValue(
      req.query.retailerType,
      "retailerType",
      retailerTypes,
      "verified_retailer"
    );

    const condition = getAllowedValue(
      req.query.condition,
      "condition",
      listingConditions,
      "new"
    );

    const stockStatus = getAllowedValue(
      req.query.stockStatus,
      "stockStatus",
      stockStatuses,
      "unknown"
    );

    const matchResult = await matchRetailerListingTitle(listingTitle, {
      limit: 5,
      minConfidence: 35,
      includeRejected: false,
      currentOnly: true,
    });

    const topMatch = matchResult.data[0];

    if (!topMatch) {
      return res.status(422).json({
        error: "No usable catalog match found for listing title",
        data: {
          listingTitle,
          matches: matchResult,
        },
      });
    }

    const canAutoSave =
      topMatch.matchStatus === "auto_matched" ||
      (allowLikelyMatch && topMatch.matchStatus === "likely_match");

    if (!canAutoSave) {
      return res.status(409).json({
        error: "Listing needs manual match review before saving",
        data: {
          topMatch,
          matches: matchResult,
          hint: "Pass allowLikelyMatch=true to save likely_match results during local testing.",
        },
      });
    }

    const result = await upsertRetailerListingWithSnapshot({
      ballId: topMatch.ballId,
      retailerName,
      retailerType,
      listingTitle,
      listingUrl,
      condition,
      matchConfidence: topMatch.confidence,
      matchStatus: topMatch.matchStatus,
      currentPrice,
      stockStatus,
    });

    return res.json({
      data: {
        selectedMatch: topMatch,
        upsert: result,
        matches: matchResult.data,
      },
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown upsert-with-match error";

    return res.status(400).json({
      error: "Failed to upsert retailer listing with match",
      details: message,
    });
  }
});

retailerRoutes.get("/manual-listing/upsert", async (req, res) => {
  try {
    const ballId = getRequiredString(req.query.ballId, "ballId");
    const retailerName = getRequiredString(req.query.retailerName, "retailerName");
    const listingTitle = getRequiredString(req.query.listingTitle, "listingTitle");
    const listingUrl = getRequiredString(req.query.listingUrl, "listingUrl");
    const currentPrice = getNumber(req.query.currentPrice, "currentPrice");

    const retailerType = getAllowedValue(
      req.query.retailerType,
      "retailerType",
      retailerTypes,
      "verified_retailer"
    );

    const condition = getAllowedValue(
      req.query.condition,
      "condition",
      listingConditions,
      "new"
    );

    const matchStatus = getAllowedValue(
      req.query.matchStatus,
      "matchStatus",
      matchStatuses,
      "manual_review"
    );

    const stockStatus = getAllowedValue(
      req.query.stockStatus,
      "stockStatus",
      stockStatuses,
      "unknown"
    );

    const matchConfidence = req.query.matchConfidence
      ? getNumber(req.query.matchConfidence, "matchConfidence")
      : 70;

    const result = await upsertRetailerListingWithSnapshot({
      ballId,
      retailerName,
      retailerType,
      listingTitle,
      listingUrl,
      condition,
      matchConfidence,
      matchStatus,
      currentPrice,
      stockStatus,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown manual listing error";

    return res.status(400).json({
      error: "Failed to upsert manual retailer listing",
      details: message,
    });
  }
});

retailerRoutes.get("/balls/:ballId/listings", async (req, res) => {
  try {
    const result = await getRetailerListingsForBall(req.params.ballId);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch retailer listings for ball",
    });
  }
});

retailerRoutes.get("/balls/:ballId/price-summary", async (req, res) => {
  try {
    const result = await getBallPriceSummary(req.params.ballId);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown price summary error";

    const statusCode = message.startsWith("No ball found") ? 404 : 500;

    return res.status(statusCode).json({
      error: "Failed to fetch ball price summary",
      details: message,
    });
  }
});

retailerRoutes.get("/match-review/skipped", async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit ?? 50);
    const sourceName = req.query.sourceName?.toString().trim();

    const result = await getRecentSkippedMatchReviews({
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50,
      sourceName: sourceName || undefined,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown match review lookup error";

    return res.status(500).json({
      error: "Failed to load skipped match reviews",
      details: message,
    });
  }
});

retailerRoutes.get("/match-review/resolve", async (req, res) => {
  try {
    const ballId = req.query.ballId?.toString().trim();
    const listingUrl = req.query.listingUrl?.toString().trim();
    const rawMatchConfidence = Number(req.query.matchConfidence ?? 100);
    const note = req.query.note?.toString().trim();
    const rawDryRun = req.query.dryRun?.toString().trim().toLowerCase();

const dryRun =
  rawDryRun === "true" || rawDryRun === "1" || rawDryRun === "yes";

    if (!ballId) {
      return res.status(400).json({
        error: "Missing required query parameter: ballId",
      });
    }

    if (!listingUrl) {
      return res.status(400).json({
        error: "Missing required query parameter: listingUrl",
      });
    }

    const result = await resolveRetailerListingMatch({
      ballId,
      listingUrl,
      matchConfidence:
        Number.isFinite(rawMatchConfidence) && rawMatchConfidence > 0
          ? rawMatchConfidence
          : 100,
      note: note || undefined,
      dryRun,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown manual match resolve error";

    return res.status(500).json({
      error: "Failed to resolve retailer listing match",
      details: message,
    });
  }
});

retailerRoutes.get("/match-review/candidates", async (req, res) => {
  try {
    const listingUrl = req.query.listingUrl?.toString().trim();
    const listingTitle = req.query.listingTitle?.toString().trim();

    const rawLimit = Number(req.query.limit ?? 10);
    const rawMinConfidence = Number(req.query.minConfidence ?? 0);

    const rawIncludeRejected = req.query.includeRejected
      ?.toString()
      .trim()
      .toLowerCase();

    const rawCurrentOnly = req.query.currentOnly
      ?.toString()
      .trim()
      .toLowerCase();

    const includeRejected =
      rawIncludeRejected === undefined
        ? true
        : rawIncludeRejected === "true" ||
          rawIncludeRejected === "1" ||
          rawIncludeRejected === "yes";

    const currentOnly =
      rawCurrentOnly === undefined
        ? true
        : rawCurrentOnly === "true" ||
          rawCurrentOnly === "1" ||
          rawCurrentOnly === "yes";

    if (!listingUrl && !listingTitle) {
      return res.status(400).json({
        error: "Either listingUrl or listingTitle is required.",
      });
    }

    const result = await getRetailerMatchCandidates({
      listingUrl: listingUrl || undefined,
      listingTitle: listingTitle || undefined,
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10,
      minConfidence:
        Number.isFinite(rawMinConfidence) && rawMinConfidence >= 0
          ? rawMinConfidence
          : 0,
      includeRejected,
      currentOnly,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown match candidate lookup error";

    return res.status(500).json({
      error: "Failed to load match candidates",
      details: message,
    });
  }
});