import { Router } from "express";
import { getCurrentDeals } from "../services/dealService";

export const dealRoutes = Router();

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

function getOptionalStringQuery(value: unknown) {
  const parsed = value?.toString().trim();

  return parsed || undefined;
}

dealRoutes.get("/", async (req, res) => {
  try {
    const limit = getNumberQuery(req.query.limit, 25);
    const brand = getOptionalStringQuery(req.query.brand);
    const retailerType = getOptionalStringQuery(req.query.retailerType);
    const minMatchConfidence = getNumberQuery(req.query.minMatchConfidence, 0);
    const verifiedOnly = getBooleanQuery(req.query.verifiedOnly, false);
    const inStockOnly = getBooleanQuery(req.query.inStockOnly, true);

    const result = await getCurrentDeals({
      limit,
      brand,
      retailerType,
      minMatchConfidence,
      verifiedOnly,
      inStockOnly,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown deals error";

    return res.status(500).json({
      error: "Failed to fetch current deals",
      details: message,
    });
  }
});