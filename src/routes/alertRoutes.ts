import { Router } from "express";
import { getPriceAlertPreview } from "../services/priceAlertPreviewService";

export const alertRoutes = Router();

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

alertRoutes.get("/price-preview", async (req, res) => {
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

    const result = await getPriceAlertPreview({
      days,
      limit,
      minPriceDrop,
      minPercentDrop,
      includeStockChanges,
      inStockOnly,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown price alert preview error";

    return res.status(500).json({
      error: "Failed to fetch price alert preview",
      details: message,
    });
  }
});