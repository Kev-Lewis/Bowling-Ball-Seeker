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
import { cleanupDuplicateRetailerListings } from "../services/retailerListingCleanupService";
import {
  getRetailerListingAdminDetail,
  getRetailerListingAdminList,
} from "../services/retailerListingAdminService";

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

function getNumberQuery(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function getOptionalBooleanQuery(value: unknown) {
  const parsed = value?.toString().trim().toLowerCase();

  if (parsed === "true" || parsed === "1" || parsed === "yes") {
    return true;
  }

  if (parsed === "false" || parsed === "0" || parsed === "no") {
    return false;
  }

  return undefined;
}

function getStringQuery(value: unknown) {
  const parsed = value?.toString().trim();

  return parsed || undefined;
}

function getMatchStatusQuery(value: unknown) {
  const parsed = value?.toString().trim();

  if (!parsed) {
    return undefined;
  }

  const allowedStatuses = new Set([
    "auto_matched",
    "likely_match",
    "manual_review",
    "manually_matched",
    "rejected",
  ]);

  if (!allowedStatuses.has(parsed)) {
    return null;
  }

  return parsed as
    | "auto_matched"
    | "likely_match"
    | "manual_review"
    | "manually_matched"
    | "rejected";
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
    const rawStatus = req.query.status?.toString().trim();

    const status =
      rawStatus === "skipped_no_match" ||
      rawStatus === "skipped_needs_review"
        ? rawStatus
        : undefined;

    if (rawStatus && !status) {
      return res.status(400).json({
        error:
          "Invalid status. Use skipped_no_match or skipped_needs_review.",
      });
    }

    const result = await getRecentSkippedMatchReviews({
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50,
      sourceName: sourceName || undefined,
      status,
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

retailerRoutes.get("/cleanup/duplicate-listings", async (req, res) => {
  try {
    const rawDryRun = req.query.dryRun?.toString().trim().toLowerCase();

    const dryRun =
      rawDryRun === undefined
        ? true
        : rawDryRun === "true" ||
          rawDryRun === "1" ||
          rawDryRun === "yes";

    const retailerName = req.query.retailerName?.toString().trim();
    const rawLimit = Number(req.query.limit ?? 50);

    const result = await cleanupDuplicateRetailerListings({
      dryRun,
      retailerName: retailerName || undefined,
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown duplicate listing cleanup error";

    return res.status(500).json({
      error: "Failed to clean up duplicate retailer listings",
      details: message,
    });
  }
});

retailerRoutes.get("/listings", async (req, res) => {
  try {
    const matchStatus = getMatchStatusQuery(req.query.matchStatus);

    if (matchStatus === null) {
      return res.status(400).json({
        error:
          "Invalid matchStatus. Use auto_matched, likely_match, manual_review, manually_matched, or rejected.",
      });
    }

    const result = await getRetailerListingAdminList({
      limit: getNumberQuery(req.query.limit, 50),
      ballId: getStringQuery(req.query.ballId),
      brand: getStringQuery(req.query.brand),
      manufacturer: getStringQuery(req.query.manufacturer),
      retailerName: getStringQuery(req.query.retailerName),
      matchStatus,
      stockStatus: getStringQuery(req.query.stockStatus),
      verifiedOnly: getOptionalBooleanQuery(req.query.verifiedOnly),
      search: getStringQuery(req.query.search),
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown retailer listing admin lookup error";

    return res.status(500).json({
      error: "Failed to load retailer listings",
      details: message,
    });
  }
});

retailerRoutes.get("/listings/:listingId", async (req, res) => {
  try {
    const listingId = req.params.listingId.trim();

    const result = await getRetailerListingAdminDetail(listingId);

    if (!result) {
      return res.status(404).json({
        error: "Retailer listing not found",
      });
    }

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown retailer listing detail lookup error";

    return res.status(500).json({
      error: "Failed to load retailer listing detail",
      details: message,
    });
  }
});