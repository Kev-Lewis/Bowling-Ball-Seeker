import { Router } from "express";
import { getRecentCatalogUpdates, getRecentlyAddedBalls, getRecentlyDiscontinuedBalls } from "../services/catalogRecentService";
import { getCatalogSummary } from "../services/catalogSummaryService";

export const catalogRoutes = Router();

function getNumberQuery(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

catalogRoutes.get("/summary", async (_req, res) => {
  try {
    const summary = await getCatalogSummary();

    return res.json({
      data: summary,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch catalog summary",
    });
  }
});

catalogRoutes.get("/recently-added", async (req, res) => {
  try {
    const days = getNumberQuery(req.query.days, 14);
    const limit = getNumberQuery(req.query.limit, 50);

    const result = await getRecentlyAddedBalls(days, limit);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch recently added balls",
    });
  }
});

catalogRoutes.get("/recently-discontinued", async (req, res) => {
  try {
    const days = getNumberQuery(req.query.days, 14);
    const limit = getNumberQuery(req.query.limit, 50);

    const result = await getRecentlyDiscontinuedBalls(days, limit);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch recently discontinued balls",
    });
  }
});

catalogRoutes.get("/recent-updates", async (req, res) => {
  try {
    const days = getNumberQuery(req.query.days, 14);
    const limit = getNumberQuery(req.query.limit, 50);

    const result = await getRecentCatalogUpdates(days, limit);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch recent catalog updates",
    });
  }
});