import { Router } from "express";
import {
  getManufacturerCatalogSyncStatus,
  getRecentScrapeRuns,
  getLatestScrapeRunForSource,
  getLatestScrapeRunsBySource,
  getScrapeRunsBySourceType,
  getScrapeRunsByStatus,
} from "../services/scrapeRunService";

export const scrapeRunRoutes = Router();

scrapeRunRoutes.get("/latest", async (req, res) => {
  try {
    const sourceName = req.query.sourceName?.toString();
    const sourceType = req.query.sourceType?.toString();

    if (!sourceName) {
      return res.status(400).json({
        error: "Missing required query parameter: sourceName",
      });
    }

    const run = await getLatestScrapeRunForSource(sourceName, sourceType);

    return res.json({
      data: run,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch latest scrape run",
    });
  }
});

scrapeRunRoutes.get("/latest-by-source", async (req, res) => {
  try {
    const sourceType = req.query.sourceType?.toString();

    const runs = await getLatestScrapeRunsBySource(sourceType);

    return res.json({
      count: runs.length,
      filters: {
        sourceType,
      },
      data: runs,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch latest scrape runs by source",
    });
  }
});

scrapeRunRoutes.get("/manufacturer-sync-status", async (_req, res) => {
  try {
    const status = await getManufacturerCatalogSyncStatus();

    return res.json({
      data: status,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch manufacturer sync status",
    });
  }
});

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