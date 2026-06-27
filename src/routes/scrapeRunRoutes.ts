import { Router } from "express";
import {
  getRecentScrapeRuns,
  getScrapeRunsBySourceType,
  getScrapeRunsByStatus,
} from "../services/scrapeRunService";

export const scrapeRunRoutes = Router();

scrapeRunRoutes.get("/", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const status = req.query.status?.toString();
    const sourceType = req.query.sourceType?.toString();

    let runs;

    if (status) {
      runs = await getScrapeRunsByStatus(status, limit);
    } else if (sourceType) {
      runs = await getScrapeRunsBySourceType(sourceType, limit);
    } else {
      runs = await getRecentScrapeRuns(limit);
    }

    return res.json({
      count: runs.length,
      data: runs,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch scrape runs",
    });
  }
});