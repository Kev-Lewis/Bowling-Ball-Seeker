import { Router } from "express";
import { getRecentPriceChanges } from "../services/priceChangeService";

export const priceChangeRoutes = Router();

function getNumberQuery(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

priceChangeRoutes.get("/recent", async (req, res) => {
  try {
    const days = getNumberQuery(req.query.days, 7);
    const limit = getNumberQuery(req.query.limit, 50);
    const minAbsChange = getNumberQuery(req.query.minAbsChange, 0.01);

    const result = await getRecentPriceChanges(days, limit, minAbsChange);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown price changes error";

    return res.status(500).json({
      error: "Failed to fetch recent price changes",
      details: message,
    });
  }
});