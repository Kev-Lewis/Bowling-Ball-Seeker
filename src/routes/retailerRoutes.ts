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