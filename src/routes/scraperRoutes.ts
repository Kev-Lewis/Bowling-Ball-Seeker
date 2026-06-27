import { Router } from "express";
import { discoverMotivBallProducts } from "../scrapers/manufacturers/motivScraper";
import {
  completeScrapeRun,
  failScrapeRun,
  startScrapeRun,
} from "../services/scrapeRunService";

export const scraperRoutes = Router();

scraperRoutes.get("/manufacturers/motiv/discover", async (_req, res) => {
  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_product_discovery",
    metadata: {
      mode: "live",
      purpose: "discover_product_links",
    },
  });

  try {
    const result = await discoverMotivBallProducts();

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: result.count,
      metadata: {
        mode: "live",
        purpose: "discover_product_links",
        sourceUrl: result.sourceUrl,
      },
    });

    return res.json({
      scrapeRunId: scrapeRun.id,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown scraper error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "live",
      purpose: "discover_product_links",
    });

    return res.status(500).json({
      error: "Failed to discover MOTIV product links",
      scrapeRunId: scrapeRun.id,
      details: message,
    });
  }
});